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

import { embedMany, generateObject, generateText } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import type { z } from 'zod';

import { getConfig, type Config } from './config.js';

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
export function createModels(config: Config = getConfig()): Models {
  const ollama = createOllama({ baseURL: `${config.ollamaUrl}/api` });
  const chatModel = ollama.chat(config.model);
  const embedModel = ollama.embedding(config.embedModel);

  // 4096 tokens of context: enough for six memories plus a question, and small enough that
  // gemma3:4b stays on this machine's 4 GB GPU. At 8192 the KV cache pushed most layers onto the
  // CPU and a single answer took ~40 s instead of ~3 s (measured on the seed eval, 2026-10-29).
  const chatOptions = { ollama: { options: { num_ctx: 4096, temperature: 0 } } };

  // Structured output gets the same context but a hard output ceiling. gemma3:4b sometimes answers
  // and then keeps generating until the context is full (measured: `finishReason: length`, 3301
  // output tokens, 146 s, truncated JSON on the seed question "Why did the petal path have to be
  // straight?"). An answer, an item list or a 180-word remembrance is far under 400 tokens, so the
  // ceiling only cuts runaways: the call fails in seconds instead of two minutes, and `answer.ts`
  // falls back to quoting the family directly.
  const objectOptions = {
    ollama: { options: { num_ctx: 4096, temperature: 0, num_predict: 400 } },
  };

  const embedDocs = async (docs: DocumentToEmbed[]): Promise<number[][]> => {
    if (docs.length === 0) return [];
    const { embeddings } = await embedMany({
      model: embedModel,
      values: docs.map((doc) => documentPrefix(doc.title, doc.text)),
      maxRetries: 1,
    });
    return embeddings;
  };

  return {
    async chat(prompt, options) {
      const { text } = await generateText({
        model: chatModel,
        prompt,
        ...(options?.system ? { system: options.system } : {}),
        temperature: 0,
        maxRetries: 1,
        providerOptions: chatOptions,
      });
      return text;
    },

    async generateObject<T>({ schema, prompt, system, schemaName }: GenerateObjectOptions<T>) {
      const { object } = await generateObject({
        model: chatModel,
        schema,
        prompt,
        ...(system ? { system } : {}),
        ...(schemaName ? { schemaName } : {}),
        temperature: 0,
        maxRetries: 2,
        experimental_repairText: async ({ text }) => repairJson(text),
        providerOptions: objectOptions,
      });
      return object;
    },

    async embedQuery(text) {
      const vectors = await embedDocs([{ text }]);
      const [vector] = vectors;
      if (!vector) throw new Error('Ollama returned no embedding for the query');
      return vector;
    },

    async embedDocuments(docs) {
      return embedDocs(docs);
    },
  };
}
