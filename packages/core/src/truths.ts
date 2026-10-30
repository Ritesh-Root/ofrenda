/**
 * Two tellers, two truths.
 *
 * Families remember differently: Lupita says the stall opened in 1959, Chucho says 1961. An ofrenda
 * that picks one quietly erases a relative. So after retrieval, Gemma is asked one narrow question:
 * do these memories, told by different people, disagree about what was asked? If it says yes, a
 * deterministic check keeps the disagreement only when every version comes from a memory that was
 * retrieved, the versions come from different tellers, and each version's words actually appear in its
 * memory. The UI then shows both, side by side, with names. The ofrenda never settles the argument.
 *
 * And when nobody told the ofrenda something, `whoMightKnow` names the relative whose stories come
 * closest, so the answer to "nobody told me" is "ask Tío Chucho", with a button to record what he says.
 */

import { z } from 'zod';

import { contentWords } from './answer.js';
import { listTellers } from './db/queries.js';
import { createModels, type Models } from './model.js';
import { searchMemories, type MemoryHit } from './search.js';

export const truthsSchema = z.object({
  conflict: z.boolean().describe('true only if two different tellers give different answers to the question'),
  about: z.string().default('').describe('what they disagree about, in a few words, in the language of the question'),
  versions: z
    .array(z.object({ memoryId: z.string(), says: z.string().describe("that teller's version, quoted or closely paraphrased from the memory") }))
    .default([]),
});
export type TruthsRaw = z.infer<typeof truthsSchema>;

export interface TruthVersion {
  memoryId: string;
  title: string;
  teller: string | null;
  says: string;
}
export interface Truths {
  conflict: boolean;
  about: string;
  versions: TruthVersion[];
}

export const TRUTHS_SYSTEM = `You compare family memories about a person who has died.
Given a question and memories (each with an id and the relative who told it), decide whether DIFFERENT relatives give DIFFERENT answers to that question (a different year, a different song, a different place, a different reason).
Details that merely add to each other are not a conflict. One relative is never in conflict with themself.
If there is a conflict, give each relative's version in their own words from their memory, with its memory id. Never decide who is right.
Return JSON only.`;

export function buildTruthsPrompt(question: string, hits: MemoryHit[]): string {
  const list = hits.map((h) => `[${h.id}] told by ${h.teller ?? 'unknown'} — ${h.title}\n${h.body}`).join('\n\n');
  return `Question: ${question}\n\nMemories:\n\n${list}`;
}

/** Deterministic guard over the model's claim of a conflict. */
export function checkTruths(raw: TruthsRaw, hits: MemoryHit[]): Truths {
  const none: Truths = { conflict: false, about: '', versions: [] };
  if (!raw.conflict) return none;
  const byId = new Map(hits.map((h) => [h.id, h]));
  const versions: TruthVersion[] = [];
  const tellers = new Set<string>();
  for (const v of raw.versions) {
    const hit = byId.get(v.memoryId);
    if (!hit || !hit.teller || tellers.has(hit.teller)) continue;
    const said = contentWords(v.says);
    const body = new Set(contentWords(hit.body));
    const grounded = said.length > 0 && said.filter((w) => body.has(w)).length / said.length >= 0.6;
    if (!grounded) continue;
    tellers.add(hit.teller);
    versions.push({ memoryId: hit.id, title: hit.title, teller: hit.teller, says: v.says.trim() });
  }
  return versions.length >= 2 ? { conflict: true, about: raw.about.trim(), versions } : none;
}

export async function findTruths(
  personId: string,
  question: string,
  options: { models?: Models; hits?: MemoryHit[] } = {},
): Promise<Truths> {
  const hits = options.hits ?? (await searchMemories(personId, question, { k: 6 }));
  if (new Set(hits.map((h) => h.teller).filter(Boolean)).size < 2) return { conflict: false, about: '', versions: [] };
  const models = options.models ?? createModels();
  const raw = await models.generateObject({ schema: truthsSchema, system: TRUTHS_SYSTEM, schemaName: 'truths', prompt: buildTruthsPrompt(question, hits) });
  return checkTruths(raw, hits);
}

export interface WhoMightKnow {
  tellerId: string;
  name: string;
  relation: string;
  because: string | null;
}

/**
 * The relative to ask when the ofrenda has no answer: whoever told the closest story (even below the
 * answer threshold), else whoever told the most. Pure ranking, no model.
 */
export async function whoMightKnow(personId: string, question: string, hits?: MemoryHit[]): Promise<WhoMightKnow | null> {
  const tellers = await listTellers(personId);
  if (tellers.length === 0) return null;
  const near = hits ?? (await searchMemories(personId, question, { k: 6 }));
  const nameOf = (t: { name: string }) => t.name;
  const top = near.find((h) => h.teller);
  const match = top && tellers.find((t) => top.teller === t.name || top.teller?.startsWith(t.name) || t.name.startsWith(top.teller ?? '\u0000'));
  const pick = match ?? tellers[0]!;
  return { tellerId: pick.id, name: nameOf(pick), relation: pick.relation, because: match && top ? top.title : null };
}
