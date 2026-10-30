/**
 * In-process ingest (SPEC §7, last paragraph).
 *
 * The same activity functions the Temporal worker calls, run one after another. That is what lets the
 * CLI work with no extra services: if Temporal is unreachable, `run-local` does the job in order and
 * reports the same `{step, done[]}` progress the workflow query exposes, so the UI does not care.
 *
 * No Temporal import lives in core — orchestration belongs to `apps/worker`.
 */

import { getConfig, type Config } from '../config.js';
import type { Models } from '../model.js';
import { getPerson } from '../db/queries.js';
import { transcribe } from './transcribe.js';
import { saveMemory } from './save.js';
import { embedMemory } from './embed.js';
import { extractItems, type ExtractedItem } from './extract.js';
import { draftRemembrance, type Remembrance } from './remembrance.js';

/** Every step this pipeline can run, in order. Mirrors the workflow's `progress` steps. */
export const INGEST_STEPS = ['transcribe', 'save', 'embed', 'extract', 'remembrance'] as const;

export type IngestStep = (typeof INGEST_STEPS)[number];

export interface IngestProgress {
  step: IngestStep;
  done: IngestStep[];
}

export interface IngestMemoryInput {
  personId: string;
  /** Used in prompts and keyterms. Read from the DB when omitted. */
  personName?: string;
  tellerId?: string | null;
  title?: string;
  text?: string;
  audioPath?: string;
  lang?: 'es' | 'en' | 'mixed';
  stt?: 'local' | 'elevenlabs';
  /** Family + item names, to bias cloud transcription. */
  keyterms?: string[];
  /** Draft a remembrance as the last step. */
  remembrance?: boolean;
  id?: string;
}

export interface IngestMemoryOptions {
  models?: Models;
  config?: Config;
  connectionString?: string;
  onProgress?: (progress: IngestProgress) => void;
}

export interface IngestResult {
  memoryId: string;
  text: string;
  lang: 'es' | 'en' | 'mixed';
  items: ExtractedItem[];
  remembrance?: Remembrance;
  progress: IngestProgress;
}

/**
 * Transcribe (audio only), save, embed, extract items, optionally draft a remembrance.
 *
 * Each step is its own function so the Temporal worker can wrap them as activities with their own
 * retry policy; this runner only decides the order.
 */
export async function ingestMemory(
  input: IngestMemoryInput,
  options: IngestMemoryOptions = {},
): Promise<IngestResult> {
  const config = options.config ?? getConfig();
  const done: IngestStep[] = [];
  const report = (step: IngestStep): void => {
    options.onProgress?.({ step, done: [...done] });
  };

  const personName = input.personName ?? (await getPerson(input.personId, options.connectionString))?.name;
  if (!personName) throw new Error(`No person ${input.personId} to add a memory to`);

  let text = input.text?.trim() ?? '';
  let lang = input.lang;
  let source: 'typed' | 'audio' | 'archive' = 'typed';

  if (!text) {
    if (!input.audioPath) throw new Error('ingestMemory needs text or an audioPath');
    report('transcribe');
    const transcript = await transcribe(
      {
        audioPath: input.audioPath,
        ...(input.stt ? { stt: input.stt } : {}),
        ...(input.keyterms ? { keyterms: input.keyterms } : {}),
        ...(input.lang ? { language: input.lang } : {}),
      },
      { config },
    );
    text = transcript.text;
    lang = transcript.lang;
    source = 'audio';
    done.push('transcribe');
  }

  report('save');
  const memory = await saveMemory(
    {
      personId: input.personId,
      tellerId: input.tellerId ?? null,
      text,
      source,
      audioPath: input.audioPath ?? null,
      ...(input.title ? { title: input.title } : {}),
      ...(lang ? { lang } : {}),
      ...(input.id ? { id: input.id } : {}),
    },
    { connectionString: options.connectionString },
  );
  done.push('save');

  report('embed');
  await embedMemory(memory.id, {
    ...(options.models ? { models: options.models } : {}),
    ...(options.connectionString ? { connectionString: options.connectionString } : {}),
  });
  done.push('embed');

  report('extract');
  const models = options.models ?? (await import('../model.js')).createModels(config);
  const items = await extractItems(
    {
      personId: input.personId,
      personName,
      memory: { id: memory.id, title: memory.title, body: memory.body, lang: memory.lang },
    },
    {
      models,
      ...(options.connectionString ? { connectionString: options.connectionString } : {}),
    },
  );
  done.push('extract');

  let remembrance: Remembrance | undefined;
  if (input.remembrance) {
    report('remembrance');
    remembrance = await draftRemembrance(
      { personId: input.personId, personName },
      {
        models,
        ...(options.connectionString ? { connectionString: options.connectionString } : {}),
      },
    );
    done.push('remembrance');
  }

  return {
    memoryId: memory.id,
    text: memory.body,
    lang: memory.lang,
    items,
    progress: { step: done[done.length - 1] ?? 'extract', done },
    ...(remembrance ? { remembrance } : {}),
  };
}
