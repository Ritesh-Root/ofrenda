/**
 * `embedMemory` activity (SPEC §7 step 3): store the EmbeddingGemma vector for one memory.
 *
 * The document side of the prompt gets the title, because that is how EmbeddingGemma was trained
 * (see the citation in `model.ts`). The vector is written back in the same call, so a memory is
 * either searchable or obviously not embedded.
 */

import type { Models } from '../model.js';
import { getMemory, setMemoryEmbedding } from '../db/queries.js';

export interface EmbedMemoryOptions {
  models?: Models;
  connectionString?: string;
}

/** Embed one memory and store its vector. Returns the vector (768 floats). */
export async function embedMemory(
  memoryId: string,
  options: EmbedMemoryOptions = {},
): Promise<number[]> {
  const memory = await getMemory(memoryId, options.connectionString);
  if (!memory) throw new Error(`No memory ${memoryId} to embed`);

  const models = options.models ?? (await import('../model.js')).createModels();
  const [vector] = await models.embedDocuments([{ title: memory.title, text: memory.body }]);
  if (!vector) throw new Error(`EmbeddingGemma returned no vector for memory ${memoryId}`);

  await setMemoryEmbedding(memoryId, vector, options.connectionString);
  return vector;
}
