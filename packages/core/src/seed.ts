/**
 * Load the fictional demo ofrenda from `seed/abuela-rosa/` (SPEC §1, §5).
 *
 * `pnpm --filter @ofrenda/core seed` migrates the database first, then writes the person, her family,
 * her stories (as memories, `source = 'seed'`), their embeddings, and the altar items with the
 * mentions that tie them back to the stories. Every write is an upsert, so running it twice is safe
 * and leaves the same rows.
 *
 * Set `OFRENDA_SEED_DIR` (or pass `seedDir`) to load a different folder with the same file names.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { getConfig } from './config.js';
import { createModels, type Models } from './model.js';
import { migrate } from './db/migrate.js';
import {
  addItemMention,
  closePool,
  listMemories,
  setMemoryEmbedding,
  upsertItem,
  upsertMemory,
  upsertPerson,
  upsertTeller,
  type OfrendaItem,
} from './db/queries.js';

export const DEFAULT_SEED_DIR = new URL('../../../seed/abuela-rosa/', import.meta.url);

interface SeedPerson {
  id: string;
  name: string;
  shortName: string;
  calledBy?: string[];
  born?: { year?: number; place?: string };
  died?: { year?: number; place?: string };
  trade?: string;
  family: { id: string; name: string; relation: string; hue: number }[];
  [key: string]: unknown;
}

interface SeedStory {
  id: string;
  title: string;
  told_by: string;
  lang: 'es' | 'en' | 'mixed';
  year?: number;
  text: string;
  items?: string[];
}

interface SeedItem {
  id: string;
  name: string;
  note?: string;
  from: string[];
}

interface SeedItemsFile {
  groups: { kind: OfrendaItem['kind']; items: SeedItem[] }[];
}

export interface SeedSummary {
  personId: string;
  tellers: number;
  memories: number;
  embedded: number;
  items: number;
  mentions: number;
}

export interface SeedOptions {
  /** Directory holding person.json, stories.json and ofrenda-items.json. */
  seedDir?: string | URL;
  models?: Models;
  /** Skip the schema step (nothing changed in the DB). */
  migrateFirst?: boolean;
  log?: (line: string) => void;
}

export async function loadSeed(options: SeedOptions = {}): Promise<SeedSummary> {
  const dir = options.seedDir ?? process.env.OFRENDA_SEED_DIR ?? DEFAULT_SEED_DIR;
  const log = options.log ?? (() => {});
  const base = dir instanceof URL ? dir : pathToFileURL(`${resolve(dir)}/`);

  if (options.migrateFirst !== false) {
    log('applying schema');
    await migrate();
  }

  const person = await readJson<SeedPerson>(new URL('person.json', base));
  const { stories } = await readJson<{ stories: SeedStory[] }>(new URL('stories.json', base));
  const itemFile = await readJson<SeedItemsFile>(new URL('ofrenda-items.json', base));

  await upsertPerson({
    id: person.id,
    name: person.name,
    shortName: person.shortName,
    bornYear: person.born?.year ?? null,
    diedYear: person.died?.year ?? null,
    bornPlace: person.born?.place ?? null,
    data: {
      calledBy: person.calledBy ?? [],
      trade: person.trade ?? null,
      died: person.died ?? null,
      fictional: true,
    },
  });

  for (const teller of person.family) {
    await upsertTeller({
      id: teller.id,
      personId: person.id,
      name: teller.name,
      relation: teller.relation,
      hue: teller.hue,
    });
  }
  log(`person ${person.id} with ${person.family.length} tellers`);

  for (const story of stories) {
    await upsertMemory({
      id: story.id,
      personId: person.id,
      tellerId: story.told_by,
      title: story.title,
      lang: story.lang,
      year: story.year ?? null,
      body: story.text,
      source: 'seed',
    });
  }
  log(`${stories.length} stories`);

  const models = options.models ?? createModels(getConfig());
  const vectors = await models.embedDocuments(
    stories.map((story) => ({ title: story.title, text: story.text })),
  );
  let embedded = 0;
  for (const [index, story] of stories.entries()) {
    const vector = vectors[index];
    if (!vector) throw new Error(`EmbeddingGemma returned no vector for story ${story.id}`);
    await setMemoryEmbedding(story.id, vector);
    embedded += 1;
  }
  log(`${embedded} stories embedded (${vectors[0]?.length ?? 0}-d)`);

  let items = 0;
  let mentions = 0;
  for (const group of itemFile.groups) {
    for (const item of group.items) {
      const id = await upsertItem({
        id: item.id,
        personId: person.id,
        kind: group.kind,
        name: item.name,
        note: item.note ?? null,
      });
      items += 1;
      for (const memoryId of item.from) {
        await addItemMention(id, memoryId);
        mentions += 1;
      }
    }
  }
  log(`${items} altar items, ${mentions} mentions`);

  return {
    personId: person.id,
    tellers: person.family.length,
    memories: stories.length,
    embedded,
    items,
    mentions,
  };
}

async function readJson<T>(url: URL): Promise<T> {
  return JSON.parse(await readFile(fileURLToPath(url), 'utf8')) as T;
}

/**
 * Seed only when the person has no memories yet. This is what `ofrenda init` uses (idempotent), and
 * what the integration tests call so they never depend on the order the Verify block runs in.
 */
export async function ensureSeeded(
  personId = 'rosa-mendez',
  options: SeedOptions = {},
): Promise<SeedSummary | null> {
  const existing = await listMemories(personId).catch(() => []);
  if (existing.length > 0) return null;
  return loadSeed(options);
}

function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && fileURLToPath(import.meta.url) === entry;
}

if (isMain()) {
  try {
    const summary = await loadSeed({ log: (line) => console.log(line) });
    console.log(
      `seeded ${summary.personId}: ${summary.memories} memories (${summary.embedded} embedded), ` +
        `${summary.tellers} tellers, ${summary.items} items, ${summary.mentions} mentions`,
    );
  } catch (error) {
    console.error(`seed failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
