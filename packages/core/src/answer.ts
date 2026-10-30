/**
 * The grounded answer (SPEC §6). The ghost never invents.
 *
 * Three layers, cheapest first:
 *   1. Retrieval with a floor: no hits, or a best RRF score under the threshold, means the ofrenda
 *      says nobody told it. No model is involved in that decision.
 *   2. Gemma answers from the retrieved memories only, in the question's language, and must cite ids.
 *   3. A deterministic guard (no model) re-checks the result: citations must be memories we actually
 *      retrieved, and the answer may not contain a capitalised name or a number that is absent from
 *      those memories. If it does, we do not patch the model's words — we throw them away and answer
 *      extractively, quoting the family directly.
 *
 * `mode` says which path ran (`model`, `extractive`, `none`). Callers put it on a Sentry span
 * attribute (SPEC §12); core does not import Sentry.
 */

import { z } from 'zod';

import { getPerson } from './db/queries.js';
import type { Models } from './model.js';
import { buildAnswerPrompt, ANSWER_SYSTEM, type AnswerMemory } from './prompts/answer.js';
import { searchMemories, type MemoryHit } from './search.js';

/** Default retrieval width. */
export const DEFAULT_K = 6;

/**
 * RRF floor, tuned on the seed (SPEC §6 says "start at 0.02"). With k=60 a memory found by one
 * retriever at rank 1 scores 1/61 ≈ 0.0164 and a memory both retrievers put first scores ≈ 0.0328.
 * 0.02 therefore means "at least one retriever liked it and the other did not hate it" — which is
 * what the seed eval wants: the four unanswerable questions fall below it, the eight answerable ones
 * clear it. See `src/eval.ts` for the measurements behind this number.
 */
export const DEFAULT_SCORE_THRESHOLD = 0.02;

export type AnswerMode = 'model' | 'extractive' | 'none';

export interface AnswerCitation {
  id: string;
  title: string;
  teller: string | null;
}

export interface Answer {
  found: boolean;
  answer: string;
  citations: AnswerCitation[];
  mode: AnswerMode;
}

export interface AnswerInput {
  personId: string;
  question: string;
  /** Defaults to the row in `people`, which is what the prompt names. */
  personName?: string;
}

export interface AnswerOptions {
  k?: number;
  threshold?: number;
  models?: Models;
  /** Injected retrieval, so the guard can be tested without a database. */
  search?: (personId: string, question: string, k: number) => Promise<MemoryHit[]>;
  connectionString?: string;
}

/** What Gemma must return. Small on purpose: three fields, all checkable. */
export const answerSchema = z.object({
  found: z.boolean().describe('true only when the memories below contain the answer'),
  answer: z
    .string()
    .default('')
    .describe('one to three sentences in the language of the question, quoting the family where possible'),
  citations: z
    .array(z.string())
    .default([])
    .describe('ids of the memories used, for example ["m1"]; never write ids inside answer'),
});

export type ModelAnswer = z.infer<typeof answerSchema>;

/** `[m1]` / `[M3]` — the form Gemma reaches for even when the schema has a citations array. */
const INLINE_CITATION = /\[([a-z0-9][a-z0-9_-]*)\]/gi;

/**
 * Repair the three things this model actually gets wrong, without trusting it further: ids written
 * inline instead of in `citations` ("[m1]"), ids left bare in the prose ("… de Noviembre m2"), and
 * those ids left behind after stripping. Only tokens that match a memory id we actually retrieved are
 * treated as citations, so ordinary words are never swallowed. Everything else passes through exactly
 * as the model said it, for the guard to accept or reject.
 */
export function normaliseModelAnswer(raw: ModelAnswer, retrievedIds: string[] = []): ModelAnswer {
  let answer = raw.answer ?? '';
  const inline = [...answer.matchAll(INLINE_CITATION)].map((match) => (match[1] ?? '').toLowerCase());
  answer = answer.replace(INLINE_CITATION, '');

  const bare: string[] = [];
  for (const id of retrievedIds) {
    const bareId = new RegExp(`\\s\\b${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
    if (bareId.test(answer)) {
      bare.push(id.toLowerCase());
      answer = answer.replace(bareId, '');
    }
  }

  const citations = dedupe([...(raw.citations ?? []), ...inline, ...bare].filter(Boolean));
  answer = answer
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { found: raw.found, answer, citations };
}

/** Ask the ofrenda a question. Never throws for "not found" — that is a valid answer. */
export async function answerQuestion(
  input: AnswerInput,
  options: AnswerOptions = {},
): Promise<Answer> {
  const k = options.k ?? DEFAULT_K;
  const threshold = options.threshold ?? DEFAULT_SCORE_THRESHOLD;
  const search =
    options.search ??
    ((personId: string, question: string, width: number) =>
      searchMemories(personId, question, { k: width }));

  const hits = await search(input.personId, input.question, k);
  const best = hits[0];
  if (!best || best.score < threshold) return notFound();

  const personName =
    input.personName ?? (await getPerson(input.personId, options.connectionString))?.name;
  if (!personName) throw new Error(`No person ${input.personId} to answer for`);

  const models = options.models ?? (await import('./model.js')).createModels();
  let modelAnswer: ModelAnswer;
  try {
    modelAnswer = await models.generateObject({
      schema: answerSchema,
      system: ANSWER_SYSTEM,
      schemaName: 'grounded_answer',
      prompt: buildAnswerPrompt({
        personName,
        question: input.question,
        memories: hits.map(toAnswerMemory),
      }),
    });
  } catch (error) {
    console.warn(`[ofrenda] model answer failed, quoting the family instead: ${(error as Error).message.slice(0, 200)}`);
    // A failed or unparseable model call is the extreme case of "the model cannot be trusted with
    // this one": the family's own sentence is still true, cited, and already retrieved, so answer
    // with it rather than reporting a crash as "nobody told the ofrenda". (Measured on the seed,
    // gemma3:4b occasionally runs on until the context is full and returns truncated JSON;
    // `num_predict` in model.ts bounds how long that costs.)
    return extractive(hits, input.question);
  }

  // The tellers' names are known too: "Lupita remembers..." is attribution, not invention.
  const tellers = hits.map((hit) => hit.teller).filter((t): t is string => !!t);
  return judge(modelAnswer, hits, input.question, [personName, ...tellers]);
}

/**
 * The deterministic guard, as a pure function: given what the model said and what retrieval actually
 * found, decide which of the three paths the answer takes. Exported so the tests can try to break it
 * without a model.
 */
export function judge(
  modelAnswer: ModelAnswer,
  hits: MemoryHit[],
  question: string,
  /** Words the ofrenda already knows for this person (her name), so they are not "invented". */
  knownNames: string[] = [],
): Answer {
  const repaired = normaliseModelAnswer(
    modelAnswer,
    hits.map((hit) => hit.id),
  );
  if (!repaired.found) return notFound();

  const byId = new Map(hits.map((hit) => [hit.id, hit]));
  const cited = dedupe(repaired.citations.filter((id) => byId.has(id)));
  const invented = inventedTerms(
    repaired.answer,
    cited.map((id) => byId.get(id)?.body ?? ''),
    knownNames,
  );

  if (cited.length === 0 || invented.length > 0) return extractive(hits, question);

  const text = repaired.answer.trim();
  if (!text) return extractive(hits, question);

  return {
    found: true,
    answer: text,
    citations: cited.map((id) => citation(byId.get(id)!)),
    mode: 'model',
  };
}

/**
 * Names and numbers in `answer` that appear nowhere in the cited stories. Case-insensitive, because a
 * sentence may start with a normal word ("Every Sunday..."), but a name the family never wrote — or a
 * number they never said — is exactly what this catches.
 */
export function inventedTerms(answer: string, bodies: string[], knownNames: string[] = []): string[] {
  const allowed = new Set<string>();
  for (const body of bodies) {
    for (const token of tokenise(body)) allowed.add(token);
    for (const number of body.match(/\d+/g) ?? []) allowed.add(number);
  }
  for (const name of knownNames) {
    for (const token of tokenise(name)) allowed.add(token);
  }

  const found: string[] = [];
  // A capital at the start of a sentence is grammar, not a name ("Cocinaba mole los domingos").
  const midSentence = answer.replace(/(^|[.!?¿¡:"“]\s*)[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/g, '$1');
  for (const word of midSentence.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/g) ?? []) {
    // `allowed` is built through `tokenise`, which lowercases *and* strips accents; compare on the
    // same footing or a name the family really wrote ("Canción", "Albán", "Méndez") looks invented.
    if (!allowed.has(normalise(word))) found.push(word);
  }
  for (const number of answer.match(/\d+/g) ?? []) {
    if (!allowed.has(number)) found.push(number);
  }
  return dedupe(found);
}

/** Words of a text, lowercased and accent-free, function words included (they are never "invented"). */
function tokenise(text: string): string[] {
  return normalise(text).match(/[a-z0-9]+/g) ?? [];
}

const STOPWORDS = new Set(
  (
    'a an the and or of to in on at for did does do she her he his was is what who where when why ' +
    'how which with it that this de la el los las y o en que qué por para con su sus le lo se una ' +
    'un cuando cómo como dónde quién'
  ).split(' '),
);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Content words: at least three letters, stopwords dropped. Same rule as `design/mockups/ask.js`. */
export function contentWords(text: string): string[] {
  return normalise(text)
    .match(/[a-zñ0-9]+/g)
    ?.filter((word) => word.length > 2 && !STOPWORDS.has(word)) ?? [];
}

/**
 * The two sentences of a story that answer the question best, in reading order.
 *
 * Ported from `bestSentences` in `design/mockups/ask.js` (the mockup ranks by word overlap and quotes
 * the family directly). One difference: the mockup had hand-written tag lists per story; we have the
 * real corpus, so the question alone provides the words.
 */
export function bestSentences(body: string, question: string): string {
  const queryWords = new Set(contentWords(question));
  const sentences = body.match(/[^.!?]+[.!?”"]+/g) ?? [body];
  const scored = sentences.map((sentence, index) => ({
    text: sentence.trim(),
    index,
    overlap: contentWords(sentence).filter((word) => queryWords.has(word)).length,
  }));
  const top = [...scored]
    .sort((a, b) => b.overlap - a.overlap || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index);
  return top
    .map((sentence) => sentence.text)
    .join(' ')
    .trim();
}

function extractive(hits: MemoryHit[], question: string): Answer {
  const top = hits[0];
  if (!top) return notFound();
  return {
    found: true,
    answer: bestSentences(top.body, question),
    citations: [citation(top)],
    mode: 'extractive',
  };
}

function citation(hit: MemoryHit): AnswerCitation {
  return { id: hit.id, title: hit.title, teller: hit.teller };
}

function toAnswerMemory(hit: MemoryHit): AnswerMemory {
  return { id: hit.id, title: hit.title, teller: hit.teller, body: hit.body };
}

function notFound(): Answer {
  return { found: false, answer: '', citations: [], mode: 'none' };
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}
