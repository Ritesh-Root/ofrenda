/**
 * Ofrenda web server: the designed pages (design/ + apps/web/public) and a small JSON/audio API over
 * @ofrenda/core. Plain node:http on purpose: no framework between the family and their stories.
 *
 *   GET  /                       → /app/
 *   GET  /api/person/:id         person, tellers, memories, altar items
 *   POST /api/ask                {personId, q} → grounded answer with citations
 *   POST /api/voice?personId=…   audio body → ElevenLabs Scribe → grounded answer (+ the heard question)
 *   POST /api/speak              {text} → audio/mpeg (ElevenLabs stock narrator)
 *   POST /api/calavera           {personId} → calavera literaria from the stories
 *   POST /api/memories           {personId, tellerId, title, text} → ingest → extracted items
 *   POST /api/memories/audio?…   audio body → Scribe → ingest
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  answerQuestion,
  findTruths,
  whoMightKnow,
  getConfig,
  getPerson,
  ingestMemory,
  listItems,
  listMemories,
  listTellers,
  speak,
  transcribe,
  writeCalavera,
  type Calavera,
} from '@ofrenda/core';

const here = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(here, '../../..');
const STATIC: Array<[prefix: string, dir: string]> = [
  ['/app/', resolve(ROOT, 'apps/web/public/app')],
  ['/assets/', resolve(ROOT, 'design/assets')],
  ['/svg/', resolve(ROOT, 'design/svg')],
  ['/audio/', resolve(ROOT, 'seed/audio')],
];
const FILES: Record<string, string> = { '/tokens.css': resolve(ROOT, 'design/tokens.css') };
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webm': 'video/webm', '.mp4': 'video/mp4',
};
const MAX_BODY = 25 * 1024 * 1024;

/** The answer, the family's disagreements about it, and who to ask when nobody told the ofrenda. */
async function fullAnswer(personId: string, question: string) {
  const [answer, truths] = await Promise.all([
    answerQuestion({ personId, question }),
    findTruths(personId, question).catch(() => ({ conflict: false, about: '', versions: [] })),
  ]);
  const ask = answer.found ? null : await whoMightKnow(personId, question).catch(() => null);
  return { ...answer, truths, ask };
}

const calaveraCache = new Map<string, { at: number; value: Calavera & { invented: string[]; model: string } }>();

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'That recording is too long for one memory.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const json = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
};

const str = (v: unknown, name: string, max = 4000): string => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${name} is required`);
  if (v.length > max) throw new HttpError(400, `${name} is too long`);
  return v.trim();
};

const ID = /^[a-z0-9-]{1,64}$/;
const personIdOf = (v: unknown): string => {
  const id = typeof v === 'string' ? v : 'rosa-mendez';
  if (!ID.test(id)) throw new HttpError(400, 'bad personId');
  return id;
};

async function keyterms(personId: string): Promise<string[]> {
  const [person, tellers, items] = await Promise.all([getPerson(personId), listTellers(personId), listItems(personId)]);
  const terms = [person?.name, person?.shortName, ...tellers.map((t) => t.name), ...items.map((i) => i.name)];
  return [...new Set(terms.filter((t): t is string => !!t).flatMap((t) => t.split(/[()]/)).map((t) => t.trim()).filter((t) => t.length > 2))].slice(0, 50);
}

async function withAudioFile<T>(audio: Buffer, contentType: string | undefined, fn: (path: string) => Promise<T>): Promise<T> {
  if (audio.length < 1000) throw new HttpError(400, 'The recording is empty.');
  const ext = contentType?.includes('wav') ? '.wav' : contentType?.includes('mp4') ? '.m4a' : contentType?.includes('mpeg') ? '.mp3' : '.webm';
  const dir = await mkdtemp(join(tmpdir(), 'ofrenda-'));
  const path = join(dir, `voice${ext}`);
  try {
    await writeFile(path, audio);
    return await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const route = `${req.method} ${url.pathname}`;

  if (req.method === 'GET' && url.pathname.startsWith('/api/person/')) {
    const id = personIdOf(url.pathname.split('/').pop());
    const [person, tellers, memories, items] = await Promise.all([getPerson(id), listTellers(id), listMemories(id), listItems(id)]);
    if (!person) throw new HttpError(404, 'No such ofrenda');
    return json(res, 200, { person, tellers, memories, items });
  }

  if (route === 'POST /api/ask') {
    const { personId, q } = JSON.parse((await body(req)).toString() || '{}');
    const started = Date.now();
    const answer = await fullAnswer(personIdOf(personId), str(q, 'q', 400));
    return json(res, 200, { ...answer, ms: Date.now() - started, model: getConfig().model });
  }

  if (route === 'POST /api/voice') {
    const personId = personIdOf(url.searchParams.get('personId'));
    const audio = await body(req);
    const started = Date.now();
    const heard = await withAudioFile(audio, req.headers['content-type'], async (path) =>
      transcribe({ audioPath: path, stt: 'elevenlabs', keyterms: await keyterms(personId) }));
    if (!heard.text) throw new HttpError(422, 'The ofrenda could not hear a question in that recording.');
    const answer = await fullAnswer(personId, heard.text);
    return json(res, 200, { question: heard.text, lang: heard.lang, ...answer, ms: Date.now() - started, model: getConfig().model });
  }

  if (route === 'POST /api/speak') {
    const { text } = JSON.parse((await body(req)).toString() || '{}');
    const audio = await speak(str(text, 'text', 2500));
    res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' });
    return void res.end(Buffer.from(audio));
  }

  if (route === 'POST /api/calavera') {
    const { personId, fresh } = JSON.parse((await body(req)).toString() || '{}');
    const id = personIdOf(personId);
    const cached = calaveraCache.get(id);
    if (cached && !fresh) return json(res, 200, cached.value);
    const value = await writeCalavera(id);
    calaveraCache.set(id, { at: Date.now(), value });
    return json(res, 200, value);
  }

  if (route === 'POST /api/memories') {
    if (getConfig().demo) throw new HttpError(403, 'This public demo is read-only. Real ofrendas run on your own machine.');
    const { personId, tellerId, title, text } = JSON.parse((await body(req)).toString() || '{}');
    const id = personIdOf(personId);
    const result = await ingestMemory({ personId: id, tellerId: typeof tellerId === 'string' ? tellerId : null, title: str(title, 'title', 120), text: str(text, 'text', 6000) });
    calaveraCache.delete(id);
    return json(res, 200, result);
  }

  if (route === 'POST /api/memories/audio') {
    if (getConfig().demo) throw new HttpError(403, 'This public demo is read-only. Real ofrendas run on your own machine.');
    const id = personIdOf(url.searchParams.get('personId'));
    const tellerId = url.searchParams.get('tellerId');
    const title = str(url.searchParams.get('title'), 'title', 120);
    const audio = await body(req);
    const result = await withAudioFile(audio, req.headers['content-type'], async (path) =>
      ingestMemory({ personId: id, tellerId: tellerId && ID.test(tellerId) ? tellerId : null, title, audioPath: path, stt: url.searchParams.get('stt') === 'local' ? 'local' : 'elevenlabs', keyterms: await keyterms(id) }));
    calaveraCache.delete(id);
    return json(res, 200, result);
  }

  throw new HttpError(404, 'No such endpoint');
}

async function serveStatic(res: ServerResponse, pathname: string): Promise<boolean> {
  let file = FILES[pathname];
  if (!file) {
    for (const [prefix, dir] of STATIC) {
      if (pathname.startsWith(prefix)) {
        const rel = normalize(decodeURIComponent(pathname.slice(prefix.length)) || 'index.html');
        const full = resolve(dir, rel.endsWith('/') ? `${rel}index.html` : rel);
        if (!full.startsWith(dir)) return false;
        file = full;
        break;
      }
    }
  }
  if (!file) return false;
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname === '/' || url.pathname === '/app') {
      res.writeHead(302, { location: '/app/' });
      return void res.end();
    }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method === 'GET' && (await serveStatic(res, url.pathname))) return;
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : String(error);
    if (status >= 500) console.error('[ofrenda] %s %s: %s', req.method, url.pathname, message);
    json(res, status, { error: status >= 500 ? 'The ofrenda could not answer just now. Try again in a moment.' : message });
  }
});

const port = Number(process.env.PORT ?? 4321);
server.listen(port, process.env.HOST ?? "127.0.0.1", () => {
  const c = getConfig();
  console.log(`Ofrenda on http://127.0.0.1:${port}  ·  ${c.provider} · answers ${c.model} · truths ${c.deepModel} · calavera ${c.poetModel} · search ${c.embedModel}`);
});
