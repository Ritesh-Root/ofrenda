/**
 * `transcribe` activity (SPEC §7 step 1).
 *
 * Two paths behind one function: local whisper.cpp, or ElevenLabs Scribe v2 as an opt-in cloud
 * adapter. The cloud path calls `assertCloudAllowed('elevenlabs-stt')` before it reads the key, so
 * `OFRENDA_OFFLINE=1` fails here and never reaches `fetch`.
 *
 * ElevenLabs request shape verified against the API reference (POST /v1/speech-to-text, form-data:
 * model_id, file, language_code, keyterms):
 * https://elevenlabs.io/docs/api-reference/speech-to-text/convert
 * `keyterms` is "a list of keyterms to bias the transcription towards", at most 1000 entries, five
 * words each — which is exactly the job of a family's names and altar items.
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { assertCloudAllowed } from '../offline.js';
import { getConfig, type Config } from '../config.js';
import { transcribeAudio } from '../adapters/whisper.js';

export type SttProvider = 'local' | 'elevenlabs';

export interface TranscribeInput {
  audioPath: string;
  /** Defaults to `OFRENDA_STT`. */
  stt?: SttProvider;
  /** Family names and item names, used to bias ElevenLabs Scribe. Ignored locally. */
  keyterms?: string[];
  language?: 'es' | 'en' | 'mixed';
}

export interface Transcript {
  text: string;
  lang: 'es' | 'en' | 'mixed';
  provider: 'whisper' | 'elevenlabs';
}

export interface TranscribeDeps {
  config?: Config;
  /** Override the local transcriber (tests). */
  transcribeLocal?: (audioPath: string) => Promise<{ text: string }>;
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
}

const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

export async function transcribe(input: TranscribeInput, deps: TranscribeDeps = {}): Promise<Transcript> {
  const config = deps.config ?? getConfig();
  const provider = input.stt ?? config.stt;

  if (provider === 'elevenlabs') {
    const { text, lang } = await transcribeElevenLabs(input, config, deps.fetchImpl ?? fetch);
    return { text, lang, provider: 'elevenlabs' };
  }

  const local = deps.transcribeLocal ?? ((audioPath: string) => transcribeAudio(audioPath));
  const { text } = await local(input.audioPath);
  return { text, lang: input.language ?? detectLanguage(text), provider: 'whisper' };
}

async function transcribeElevenLabs(
  input: TranscribeInput,
  config: Config,
  fetchImpl: typeof fetch,
): Promise<{ text: string; lang: 'es' | 'en' | 'mixed' }> {
  assertCloudAllowed('elevenlabs-stt');

  const apiKey = config.elevenlabs.apiKey;
  if (!apiKey) {
    throw new Error(
      'OFRENDA_STT=elevenlabs but ELEVENLABS_API_KEY is empty. Set the key or use OFRENDA_STT=local.',
    );
  }

  const audio = await readFile(input.audioPath);
  const form = new FormData();
  form.append('model_id', 'scribe_v2');
  form.append('file', new Blob([new Uint8Array(audio)]), basename(input.audioPath));
  if (input.language && input.language !== 'mixed') form.append('language_code', input.language);
  for (const keyterm of input.keyterms ?? []) form.append('keyterms', keyterm);

  const response = await fetchImpl(ELEVENLABS_STT_URL, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs speech-to-text failed: HTTP ${response.status}`);
  }

  const body = (await response.json()) as { text?: string; language_code?: string };
  const text = (body.text ?? '').trim();
  return { text, lang: normaliseLanguage(body.language_code) ?? detectLanguage(text) };
}

const SPANISH_MARKERS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'un', 'una', 'con', 'para', 'por',
  'su', 'sus', 'mi', 'mis', 'no', 'se', 'lo', 'le', 'es', 'era', 'fue', 'como', 'pero', 'muy',
]);

const ENGLISH_MARKERS = new Set([
  'the', 'and', 'she', 'her', 'was', 'were', 'with', 'for', 'that', 'this', 'when', 'every',
  'had', 'would', 'said', 'they', 'his', 'him', 'not', 'but', 'all', 'one', 'there',
]);

/**
 * Guess the language of a transcript from function words, at the level of detail the data model
 * allows (`es`, `en`, `mixed`). Deterministic, no model: a test can pin it.
 */
export function detectLanguage(text: string): 'es' | 'en' | 'mixed' {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z]+/g) ?? [];

  let spanish = 0;
  let english = 0;
  for (const word of words) {
    if (SPANISH_MARKERS.has(word)) spanish += 1;
    else if (ENGLISH_MARKERS.has(word)) english += 1;
  }
  if (spanish === 0 && english === 0) return 'en';
  if (spanish >= english * 3) return 'es';
  if (english >= spanish * 3) return 'en';
  return 'mixed';
}

function normaliseLanguage(code: string | undefined): 'es' | 'en' | 'mixed' | undefined {
  if (!code) return undefined;
  const base = code.toLowerCase().split(/[-_]/)[0];
  if (base === 'es') return 'es';
  if (base === 'en') return 'en';
  return 'mixed';
}
