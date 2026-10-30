/**
 * `draftRemembrance` activity (SPEC §7 step 5): 120–180 warm words addressed to the family, built
 * only from what the family already told the ofrenda.
 *
 * Stored in `remembrances` with the ids it was written from, so the UI can always show the sources.
 */

import { getConfig } from '../config.js';
import type { Models } from '../model.js';
import { buildRemembrancePrompt, REMEMBRANCE_SYSTEM } from '../prompts/remembrance.js';
import { listMemories, saveRemembrance, type MemoryRow } from '../db/queries.js';

export interface RemembranceInput {
  personId: string;
  personName: string;
  /** Defaults to the most recent `limit` memories of the person. */
  memories?: MemoryRow[];
  limit?: number;
}

export interface RemembranceOptions {
  models?: Models;
  connectionString?: string;
}

export interface Remembrance {
  id: number;
  body: string;
  model: string;
  memoryIds: string[];
}

export async function draftRemembrance(
  input: RemembranceInput,
  options: RemembranceOptions = {},
): Promise<Remembrance> {
  const memories =
    input.memories ?? (await listMemories(input.personId, options.connectionString));
  if (memories.length === 0) {
    throw new Error('Nothing has been told to the ofrenda yet, so there is nothing to remember.');
  }

  const limit = input.limit ?? 8;
  const chosen = memories.slice(-limit);
  const models = options.models ?? (await import('../model.js')).createModels();

  const body = (
    await models.chat(buildRemembrancePrompt({ personName: input.personName, memories: chosen }), {
      system: REMEMBRANCE_SYSTEM,
    })
  ).trim();

  const memoryIds = chosen.map((memory) => memory.id);
  const model = getConfig().model;
  const id = await saveRemembrance({
    personId: input.personId,
    body,
    model,
    memoryIds,
    connectionString: options.connectionString,
  });

  return { id, body, model, memoryIds };
}
