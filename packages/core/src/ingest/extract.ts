/**
 * `extractItems` activity (SPEC §7 step 4): read one story, list what belongs on the altar, and write
 * `ofrenda_items` + `item_mentions`.
 *
 * Structured output, not prose: Gemma fills a zod schema through `generateObject`, so one malformed
 * answer costs a retry (Temporal owns that policy) instead of a regex.
 *
 * Items are keyed by a slug of their name, so "Canción Mixteca" from one story and "cancion mixteca"
 * from another are the same row, and every story that mentions it adds a mention.
 */

import { z } from 'zod';

import type { Models } from '../model.js';
import { buildExtractPrompt, EXTRACT_SYSTEM } from '../prompts/extract.js';
import { addItemMention, slugify, upsertItem, type OfrendaItem } from '../db/queries.js';

export const ITEM_KINDS = ['food', 'song', 'place', 'saying', 'ritual', 'photo', 'date'] as const;

export const extractionSchema = z.object({
  items: z
    .array(
      z.object({
        kind: z.enum(ITEM_KINDS),
        name: z.string().trim().min(1),
        note: z.string().trim().optional().default(''),
      }),
    )
    .default([]),
});

export type Extraction = z.infer<typeof extractionSchema>;

export interface ExtractInput {
  personId: string;
  personName: string;
  memory: { id: string; title: string; body: string; lang: 'es' | 'en' | 'mixed' };
}

export interface ExtractOptions {
  models?: Models;
  connectionString?: string;
}

export interface ExtractedItem {
  id: string;
  kind: OfrendaItem['kind'];
  name: string;
  note: string | null;
}

/**
 * Ask Gemma what altar items this story mentions, then upsert them and record the mentions.
 * Returns the rows as they now exist, in the order the model produced them.
 */
export async function extractItems(
  input: ExtractInput,
  options: ExtractOptions = {},
): Promise<ExtractedItem[]> {
  const models = options.models ?? (await import('../model.js')).createModels();
  const extraction = await models.generateObject({
    schema: extractionSchema,
    system: EXTRACT_SYSTEM,
    schemaName: 'ofrenda_items',
    prompt: buildExtractPrompt({
      personName: input.personName,
      title: input.memory.title,
      body: input.memory.body,
      lang: input.memory.lang,
    }),
  });

  const saved: ExtractedItem[] = [];
  for (const item of extraction.items) {
    const id = await upsertItem(
      {
        personId: input.personId,
        kind: item.kind,
        name: item.name,
        note: item.note || null,
      },
      options.connectionString,
    );
    await addItemMention(id, input.memory.id, options.connectionString);
    saved.push({ id, kind: item.kind, name: item.name, note: item.note || null });
  }
  return saved;
}

/** Accent-insensitive words, for comparing two item names. */
function nameTokens(name: string): string[] {
  return (slugify(name).split('-').filter(Boolean) ?? []) as string[];
}

/**
 * Do two item names refer to the same thing? Used by the extraction recall test (golden file
 * `ofrenda-items.json`), where "Mole negro" and "mole negro de Oaxaca" must count as a match:
 * identical slugs, one name contained in the other, or at least 70% shared tokens.
 */
export function matchesItemName(a: string, b: string): boolean {
  const slugA = slugify(a);
  const slugB = slugify(b);
  if (!slugA || !slugB) return false;
  if (slugA === slugB) return true;
  if (slugA.includes(slugB) || slugB.includes(slugA)) return true;

  const tokensA = new Set(nameTokens(a));
  const tokensB = new Set(nameTokens(b));
  const shared = [...tokensA].filter((token) => tokensB.has(token)).length;
  return shared / Math.max(tokensA.size, tokensB.size) >= 0.7;
}
