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
import { getConfig } from './config.js';
import { createModels, type Models } from './model.js';

export const calaveraSchema = z.object({
  title: z.string().describe('Spanish title in broadsheet style, e.g. "La Calavera de Doña Rosa"'),
  // Stanza count is enforced after parsing (toQuatrains), not in the schema, so a model that returns one
  // line per item instead of one stanza per item is regrouped rather than rejected.
  es: z.array(z.string()).describe('four Spanish quatrains, each one string with its four lines separated by newlines, rhyming'),
  en: z.array(z.string()).describe('the same four quatrains translated to English, same shape'),
  memoryIds: z.array(z.string()).describe('ids of the memories the details came from'),
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

/**
 * Models return stanzas either as one string per quatrain ("line\nline\nline\nline") or as one
 * string per line. Normalise to quatrains: split everything into lines, drop blanks, group by four.
 */
export function toQuatrains(parts: string[]): string[] {
  const lines = parts.flatMap((p) => p.split(/\n+/)).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 4) out.push(lines.slice(i, i + 4).join('\n'));
  return out;
}

export async function writeCalavera(personId: string, options: { models?: Models } = {}): Promise<Calavera & { invented: string[]; model: string }> {
  const person = await getPerson(personId);
  if (!person) throw new Error(`No person ${personId}`);
  const memories = await listMemories(personId);
  if (memories.length === 0) throw new Error('A calavera needs at least one story.');
  const poet = getConfig().poetModel;
  const models = options.models ?? createModels(getConfig(), { model: poet, thinking: false });
  const raw = await models.generateObject({
    schema: calaveraSchema,
    system: CALAVERA_SYSTEM,
    schemaName: 'calavera',
    maxOutputTokens: 4000,
    prompt: buildCalaveraPrompt(person.name, memories.map((m) => ({ id: m.id, title: m.title, body: m.body }))),
  });
  raw.es = toQuatrains(raw.es).slice(0, 5);
  raw.en = toQuatrains(raw.en).slice(0, 5);
  if (raw.es.length < 2 || raw.en.length < 2) throw new Error('The calavera came back too short; not shown.');
  const ids = new Set(memories.map((m) => m.id));
  const memoryIds = raw.memoryIds.filter((id) => ids.has(id));
  if (memoryIds.length === 0) throw new Error('The calavera cited no real memory; not shown.');
  const calavera = { ...raw, memoryIds };
  return { ...calavera, invented: inventedNames(calavera, memories, person.name), model: poet };
}
