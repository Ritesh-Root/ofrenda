/**
 * `saveMemory` activity (SPEC §7 step 2): one story becomes one `memories` row.
 *
 * Idempotency comes from the caller's id: a typed story gets a fresh uuid, a seed story keeps the id
 * the seed file gave it, so re-running ingest never duplicates a memory.
 */

import { randomUUID } from 'node:crypto';

import { upsertMemory, type MemoryRow } from '../db/queries.js';
import { detectLanguage } from './transcribe.js';

export interface SaveMemoryInput {
  personId: string;
  tellerId?: string | null;
  /** Defaults to the first ~60 characters of the text. */
  title?: string;
  text: string;
  lang?: 'es' | 'en' | 'mixed';
  source: MemoryRow['source'];
  audioPath?: string | null;
  /** Defaults to a fresh uuid. Seeds pass their own id. */
  id?: string;
}

export interface SaveMemoryOptions {
  connectionString?: string;
}

/** Trim, and refuse to write an empty memory. */
export async function saveMemory(
  input: SaveMemoryInput,
  options: SaveMemoryOptions = {},
): Promise<MemoryRow> {
  const body = input.text.trim();
  if (!body) throw new Error('Cannot save a memory with no text');

  return upsertMemory(
    {
      id: input.id ?? randomUUID(),
      personId: input.personId,
      tellerId: input.tellerId ?? null,
      title: input.title?.trim() || deriveTitle(body),
      lang: input.lang ?? detectLanguage(body),
      body,
      source: input.source,
      audioPath: input.audioPath ?? null,
    },
    options.connectionString,
  );
}

/** A readable title when the family did not give one. */
export function deriveTitle(body: string): string {
  const firstSentence = body.split(/(?<=[.!?])\s/)[0] ?? body;
  const title = firstSentence.trim();
  return title.length <= 60 ? title : `${title.slice(0, 57).trimEnd()}...`;
}
