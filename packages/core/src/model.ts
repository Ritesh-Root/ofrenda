/**
 * Model access, and nothing else (SPEC §2, §4).
 *
 * Gemma via Ollama on the family's own laptop is the only model in the core. This module is the seam
 * between the rest of the package and the AI SDK: callers ask for a string, a typed object, or a set
 * of vectors, and get one. Every model call takes its dependencies from `Config`, so a test can hand
 * in a fake `Models` object and never touch the network.
 *
 * EmbeddingGemma prompt prefixes (SPEC §5): the model card prescribes a task string per side of the
 * retrieval. The EmbeddingGemma paper states them as
 *   query:    "task: search result | query: {content}"
 *   document: "title: {title | 'none'} | text: {content}"
 * (Google DeepMind, "EmbeddingGemma: Lightweight and State-of-the-Art Multilingual Embeddings",
 *  arXiv:2509.20354, §2.2 Training / Input — https://arxiv.org/html/2509.20354v1#S2.SS2.
 *  The ollama.com model card itself does not document the prefixes, which is why the paper is cited.)
 *
 * Both sides must use the same prefix scheme; using one only at query time quietly degrades recall.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { embedMany, generateObject, generateText } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import type { z } from 'zod';

import { getConfig, type Config } from './config.js';
import { assertCloudAllowed } from './offline.js';

/** Vector width stored in `memories.embedding` (schema.sql). */
export const EMBED_DIM = 768;

/**
 * Qwen3-Embedding (the Featherless default) is instruction-aware on the query side only: the model
 * card prescribes `Instruct: {task}\nQuery:{query}` for queries and the raw passage for documents.
 * Its 1024-d output is Matryoshka-trained, so the first 768 dimensions, re-normalised, are a valid
 * smaller embedding and fit the same `vector(768)` column EmbeddingGemma uses locally.
 */
export const QWEN_QUERY_INSTRUCT =
  'Instruct: Given a question about a person who has died, retrieve the family stories that answer it\nQuery:';

/**
 * Featherless plans allow a fixed number of concurrency units at once, and each model costs 1, 2 or 4
 * (the `concurrency_cost` in its /v1/models entry). Requests over the budget are rejected, so every
 * Featherless call waits for its units here instead. Process-wide: the web server's parallel answer +
 * comparison, and the seed's embeddings, all share one budget.
 */
const KNOWN_COSTS: Record<string, number> = {
  'google/gemma-4-31B-it': 2,
  'google/gemma-4-26B-A4B-it': 2,
  'Qwen/Qwen3.8-27B': 2,
};
export function featherlessCost(modelId: string): number {
  return KNOWN_COSTS[modelId] ?? (/embedding/i.test(modelId) ? 1 : 4);
}

class UnitBudget {
  private used = 0;
  private queue: Array<() => void> = [];
  constructor(readonly max: number) {}
  async run<T>(cost: number, fn: () => Promise<T>): Promise<T> {
    const need = Math.min(cost, this.max);
    while (this.used + need > this.max) await new Promise<void>((r) => this.queue.push(r));
    this.used += need;
    try {
      return await fn();
    } finally {
      this.used -= need;
      this.queue.splice(0).forEach((wake) => wake());
    }
  }
}
let budget: UnitBudget | undefined;
function featherlessBudget(max: number): UnitBudget {
  if (!budget || budget.max !== max) budget = new UnitBudget(max);
  return budget;
}

/** Truncate a Matryoshka embedding to `dim` and L2-normalise it. */
export function fitDimensions(vector: number[], dim = EMBED_DIM): number[] {
  if (vector.length < dim) throw new Error(`Embedding has ${vector.length} dimensions, need ${dim}`);
  const cut = vector.slice(0, dim);
  const norm = Math.hypot(...cut) || 1;
  return cut.map((x) => x / norm);
}

/** Prefix for a search query, from the EmbeddingGemma paper (§2.2). */
export const QUERY_PREFIX = 'task: search result | query: ';

/** Prefix for a passage on the document side, from the EmbeddingGemma paper (§2.2). */
export function documentPrefix(title: string | undefined, text: string): string {
  return `title: ${title && title.trim() ? title.trim() : 'none'} | text: ${text}`;
}

/** Prefix a query string exactly the way EmbeddingGemma was trained to see queries. */
export function queryPrompt(text: string): string {
  return `${QUERY_PREFIX}${text.trim()}`;
}

/** A passage to embed on the document side. */
export interface DocumentToEmbed {
  title?: string;
  text: string;
}

export interface GenerateObjectOptions<T> {
  schema: z.ZodType<T>;
  prompt: string;
  system?: string;
  /** Schema name shown to the model, when the provider supports it. */
  schemaName?: string;
  /** Output ceiling for this call (Featherless). Default 700: an answer or an item list. */
  maxOutputTokens?: number;
}

/**
 * The whole model surface the package needs. Small on purpose: a caller never sees the AI SDK, and a
 * test never needs a server.
 */
export interface Models {
  /** One chat completion, returned as text. */
  chat(prompt: string, options?: { system?: string }): Promise<string>;
  /** A structured result, validated by the zod schema the caller passes. */
  generateObject<T>(options: GenerateObjectOptions<T>): Promise<T>;
  /** Embed one search query with the query prefix. */
  embedQuery(text: string): Promise<number[]>;
  /** Embed passages with the document prefix, one vector per input, in order. */
  embedDocuments(docs: DocumentToEmbed[]): Promise<number[][]>;
}

export interface OllamaStatus {
  up: boolean;
  /** Model names Ollama reports, e.g. `gemma3:4b`. */
  names: string[];
  error?: string;
}

/**
 * Is Ollama up, and which models are pulled? Used by `ofrenda doctor` and by tests to decide whether
 * a model-dependent test can run. Never throws.
 */
export async function ollamaStatus(
  config: Config = getConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<OllamaStatus> {
  try {
    const response = await fetchImpl(`${config.ollamaUrl}/api/tags`);
    if (!response.ok) return { up: false, names: [], error: `HTTP ${response.status}` };
    const body = (await response.json()) as { models?: { name?: string }[] };
    return { up: true, names: (body.models ?? []).map((m) => m.name ?? '').filter(Boolean) };
  } catch (error) {
    return { up: false, names: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/** Does Ollama have this model pulled? `embeddinggemma` is reported as `embeddinggemma:latest`. */
export function hasModel(status: OllamaStatus, name: string): boolean {
  return status.names.some((candidate) => candidate === name || candidate === `${name}:latest`);
}

/**
 * Recover a JSON object from a model answer wrapped in prose or a markdown fence, and return `null`
 * when there is nothing to repair. Handed to the AI SDK as `experimental_repairText`, so a stray
 * "Here is the answer:" does not cost a whole retry.
 */
export function repairJson(text: string): string | null {
  const withoutFence = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  const candidate = withoutFence.slice(start, end + 1);
  return candidate === text.trim() ? null : candidate;
}

/** Build a `Models` bound to one config (and therefore one Ollama URL and one pair of models). */
export interface CreateModelsOptions {
  /** Chat model for this job; defaults to `config.model`. */
  model?: string;
  /**
   * Hybrid reasoning models (DeepSeek V4.x) spend their whole output budget on hidden reasoning when
   * asked for a long structured answer: measured 4,000 reasoning tokens, `finish_reason: length`, no
   * content. `false` sends Featherless the chat-template switch that turns it off (4.6 s, verse
   * delivered). Models that require reasoning reject the switch, so it is opt-in per job.
   */
  thinking?: boolean;
}

export function createModels(config: Config = getConfig(), options: CreateModelsOptions = {}): Models {
  const featherless = config.provider === 'featherless';
  const chatId = options.model ?? config.model;
  const limit = featherless ? featherlessBudget(config.featherless.concurrency) : undefined;
  const gate = <T>(modelId: string, fn: () => Promise<T>): Promise<T> =>
    limit ? limit.run(featherlessCost(modelId), fn) : fn();
  let chatModel;
  let embedModel;
  type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>;
  let chatOptions: ProviderOptions = {};
  let objectOptions: ProviderOptions = {};

  if (featherless) {
    assertCloudAllowed('featherless');
    if (!config.featherless.apiKey) {
      throw new Error('OFRENDA_PROVIDER=featherless but FEATHERLESS_API_KEY is empty. Set it, or use OFRENDA_PROVIDER=ollama.');
    }
    const provider = createOpenAICompatible({
      name: 'featherless',
      baseURL: config.featherless.url,
      apiKey: config.featherless.apiKey,
      supportsStructuredOutputs: true,
    });
    chatModel = provider.chatModel(chatId);
    embedModel = provider.textEmbeddingModel(config.embedModel);
    if (options.thinking === false) {
      const off = { chat_template_kwargs: { thinking: false, enable_thinking: false } };
      chatOptions = { featherless: off };
      objectOptions = { featherless: off };
    }
  } else {
    const ollama = createOllama({ baseURL: `${config.ollamaUrl}/api` });
    chatModel = ollama.chat(chatId);
    embedModel = ollama.embedding(config.embedModel);

    // 4096 tokens of context: enough for six memories plus a question, and small enough that
    // gemma3:4b stays on this machine's 4 GB GPU. At 8192 the KV cache pushed most layers onto the
    // CPU and a single answer took ~40 s instead of ~3 s (measured on the seed eval, 2026-10-29).
    chatOptions = { ollama: { options: { num_ctx: 4096, temperature: 0 } } };

    // Structured output gets a hard output ceiling: gemma3:4b sometimes keeps generating until the
    // context is full (measured: 3301 output tokens, 146 s, truncated JSON). 400 tokens only cuts
    // runaways, and `answer.ts` falls back to quoting the family directly.
    objectOptions = { ollama: { options: { num_ctx: 4096, temperature: 0, num_predict: 400 } } };
  }

  const docText = (doc: DocumentToEmbed): string =>
    featherless ? `${doc.title ? `${doc.title}\n` : ''}${doc.text}` : documentPrefix(doc.title, doc.text);
  const queryText = (text: string): string =>
    featherless ? `${QWEN_QUERY_INSTRUCT}${text.trim()}` : text;
  const fit = (vectors: number[][]): number[][] => (featherless ? vectors.map((v) => fitDimensions(v)) : vectors);

  const embedDocs = async (docs: DocumentToEmbed[]): Promise<number[][]> => {
    if (docs.length === 0) return [];
    const { embeddings } = await gate(config.embedModel, () =>
      embedMany({ model: embedModel, values: docs.map(docText), maxRetries: 2 }));
    return fit(embeddings);
  };

  const embedQueryRaw = async (text: string): Promise<number[]> => {
    const { embeddings } = await gate(config.embedModel, () =>
      embedMany({ model: embedModel, values: [queryText(text)], maxRetries: 2 }));
    const [vector] = fit(embeddings);
    if (!vector) throw new Error('The embedding model returned no vector for the query');
    return vector;
  };

  return {
    async chat(prompt, options) {
      const { text } = await gate(chatId, () => generateText({
        model: chatModel,
        prompt,
        ...(options?.system ? { system: options.system } : {}),
        temperature: featherless ? 0.7 : 0,
        maxRetries: featherless ? 2 : 1,
        providerOptions: chatOptions,
      }));
      return text;
    },

    async generateObject<T>({ schema, prompt, system, schemaName, maxOutputTokens }: GenerateObjectOptions<T>) {
      const { object } = await gate(chatId, () => generateObject({
        model: chatModel,
        schema,
        prompt,
        ...(system ? { system } : {}),
        ...(schemaName ? { schemaName } : {}),
        temperature: 0,
        maxRetries: 2,
        experimental_repairText: async ({ text }) => repairJson(text),
        ...(featherless ? { maxOutputTokens: maxOutputTokens ?? 700 } : {}),
        providerOptions: objectOptions,
      }));
      return object;
    },

    async embedQuery(text) {
      // Ollama/EmbeddingGemma: the caller already applied `queryPrompt`. Featherless/Qwen3: instruction added here.
      return featherless ? embedQueryRaw(text) : (await embedDocs([{ text }]))[0]!;
    },

    async embedDocuments(docs) {
      return embedDocs(docs);
    },
  };
}
