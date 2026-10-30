/**
 * La calavera: a *calavera literaria* written from the family's stories.
 *
 * Calaveras literarias are a Día de los Muertos tradition since Posada's broadsheets: short rhyming
 * verses in which La Catrina (Death) comes for someone and the verse teases them with their own
 * habits. Here every detail must come from a memory the family recorded: the model gets the stories,
 * returns the verse plus the ids it drew from, and a deterministic check drops the verse if it cites a
 * memory it was not given or names someone who appears in none of them.
 */

import { z } from 'zod';

import { getPerson, listMemories } from './db/queries.js';
import { createModels, type Models } from './model.js';

export const calaveraSchema = z.object({
  title: z.string().describe('Spanish title in broadsheet style, e.g. "La Calavera de Doña Rosa"'),
  es: z.array(z.string()).min(3).max(5).describe('three to five Spanish quatrains, lines separated by \\n, rhyming'),
  en: z.array(z.string()).min(3).max(5).describe('the same quatrains translated to English, lines separated by \\n'),
  memoryIds: z.array(z.string()).min(1).describe('ids of the memories each detail came from'),
});
export type Calavera = z.infer<typeof calaveraSchema>;

export const CALAVERA_SYSTEM = `You write calaveras literarias, the rhyming Día de los Muertos verses printed on Posada's broadsheets.
Form: quatrains of octosyllabic lines, rhyme ABAB or ABBA, playful and affectionate, never cruel.
Story: La Catrina comes to take the person; their own habits and sayings outwit, delay or charm her; she takes them anyway, gently.
Hard rule: every concrete detail (food, place, song, saying, habit, name, number) must come from the memories given. Invent nothing about the person.
Write Spanish first, then a faithful English translation that keeps the warmth (rhyme optional in English).
Return JSON only.`;

export function buildCalaveraPrompt(name: string, memories: { id: string; title: string; body: string }[]): string {
  const list = memories.map((m) => `[${m.id}] ${m.title}\n${m.body}`).join('\n\n');
  return `Person: ${name}\n\nMemories from the family:\n\n${list}\n\nWrite her calavera.`;
}

/** Capitalised words in the verse that occur in no memory (and are not verse vocabulary). */
export function inventedNames(calavera: Calavera, memories: { title: string; body: string }[], personName: string): string[] {
  const corpus = `${personName} ${memories.map((m) => `${m.title} ${m.body}`).join(' ')}`.toLowerCase();
  const allowed = new Set(['la', 'el', 'los', 'las', 'catrina', 'muerte', 'flaca', 'calavera', 'doña', 'don', 'dios', 'death', 'the', 'and', 'but', 'she', 'her', 'when', 'with', 'y', 'que', 'con', 'por', 'pero', 'ni', 'ya', 'a', 'en', 'de', 'del', 'su', 'se', 'no', 'si', 'oh', 'ay']);
  const words = [calavera.title, ...calavera.es, ...calavera.en].join(' ').match(/(?<![.!?¡¿]\s|^|\n)\b\p{Lu}[\p{L}]+/gu) ?? [];
  return [...new Set(words)].filter((w) => !allowed.has(w.toLowerCase()) && !corpus.includes(w.toLowerCase()));
}

export async function writeCalavera(personId: string, options: { models?: Models } = {}): Promise<Calavera & { invented: string[] }> {
  const person = await getPerson(personId);
  if (!person) throw new Error(`No person ${personId}`);
  const memories = await listMemories(personId);
  if (memories.length === 0) throw new Error('A calavera needs at least one story.');
  const models = options.models ?? createModels();
  const raw = await models.generateObject({
    schema: calaveraSchema,
    system: CALAVERA_SYSTEM,
    schemaName: 'calavera',
    prompt: buildCalaveraPrompt(person.name, memories.map((m) => ({ id: m.id, title: m.title, body: m.body }))),
  });
  const ids = new Set(memories.map((m) => m.id));
  const memoryIds = raw.memoryIds.filter((id) => ids.has(id));
  if (memoryIds.length === 0) throw new Error('The calavera cited no real memory; not shown.');
  const calavera = { ...raw, memoryIds };
  return { ...calavera, invented: inventedNames(calavera, memories, person.name) };
}
