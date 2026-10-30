/**
 * Configuration, validated once with zod (SPEC §4).
 *
 * The contract, in one place: every environment variable Ofrenda knows about, its default, and the
 * camelCase `Config` object the rest of the package reads. Nothing else in the codebase parses
 * `process.env`; call `loadConfig()` with an env object in tests, `getConfig()` in production code.
 *
 * Empty strings count as "unset" (that is what `.env.example` leaves behind), and an invalid value
 * fails loudly with the variable's name rather than turning into a mysterious undefined later.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { z } from 'zod';

/**
 * Load the repo's `.env` (the one next to pnpm-workspace.yaml) into `process.env`, once. Variables
 * already set in the environment win. Only `getConfig()` calls this, so `loadConfig({...})` in tests
 * stays pure.
 */
let envLoaded = false;
export function loadDotEnv(start = process.cwd()): string | undefined {
  if (envLoaded) return undefined;
  envLoaded = true;
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      const file = join(dir, '.env');
      if (existsSync(file)) {
        process.loadEnvFile(file);
        return file;
      }
      return undefined;
    }
    if (dirname(dir) === dir) return undefined;
  }
}

/** `'1'` enables, `'0'` disables. Everything else is a configuration error. */
const flag = z.enum(['0', '1']);

/** Trimmed text, with the empty string treated as unset (`.env.example` leaves names blank). */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

/**
 * Where the open-weight models run. `featherless` (default) serves them serverless over an
 * OpenAI-compatible API, so nothing has to fit on the family's GPU; `ollama` runs them on this machine.
 * Both serve the same open weights: switching is one variable, not a rewrite.
 */
export const PROVIDER_DEFAULTS = {
  // Answers on the newest Gemma; disagreements and the calavera on the newest DeepSeek; retrieval on
  // the largest Qwen3 embedding model (Featherless catalogue, 2026-10-30). Qwen3.8-2.4T and Kimi-K3
  // were tried for the calavera: both spent the whole output budget reasoning (90 s, no verse) and
  // Qwen3.8 refuses to run with reasoning off. DeepSeek-V4.1-Flash with reasoning off wrote it in 4.6 s.
  featherless: {
    model: 'google/gemma-4-31B-it',
    deepModel: 'deepseek-ai/DeepSeek-V4.1-Flash-1017',
    poetModel: 'deepseek-ai/DeepSeek-V4.1-Flash-1017',
    embedModel: 'Qwen/Qwen3-Embedding-8B',
  },
  ollama: { model: 'gemma3:4b', deepModel: 'gemma3:4b', poetModel: 'gemma3:4b', embedModel: 'embeddinggemma' },
} as const;

export const envSchema = z.object({
  OFRENDA_OFFLINE: flag.default('0'),
  OFRENDA_PROVIDER: z.enum(['featherless', 'ollama']).optional(),
  FEATHERLESS_API_KEY: optionalText,
  FEATHERLESS_URL: z.string().trim().min(1).default('https://api.featherless.ai/v1'),
  OLLAMA_URL: z.string().trim().min(1).default('http://127.0.0.1:11434'),
  OFRENDA_MODEL: optionalText,
  OFRENDA_DEEP_MODEL: optionalText,
  OFRENDA_POET_MODEL: optionalText,
  OFRENDA_EMBED_MODEL: optionalText,
  /** Concurrency units your Featherless plan allows at once (each model costs 1, 2 or 4). */
  FEATHERLESS_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
  // Local compose credentials (infra/compose.yaml): user, password and database are all "ofrenda".
  DATABASE_URL: z.string().trim().min(1).default('postgres://ofrenda:ofrenda@127.0.0.1:5432/ofrenda'),
  OFRENDA_STT: z.enum(['local', 'elevenlabs']).default('local'),
  OFRENDA_TTS: z.enum(['browser', 'elevenlabs', 'none']).default('browser'),
  ELEVENLABS_API_KEY: optionalText,
  ELEVENLABS_VOICE_ID: z.string().trim().min(1).default('EXAVITQu4vr4xnSDxMaL'),
  SERPAPI_API_KEY: optionalText,
  TEMPORAL_ADDRESS: z.string().trim().min(1).default('127.0.0.1:7233'),
  SENTRY_DSN: optionalText,
  FGA_API_URL: optionalText,
  FGA_STORE_ID: optionalText,
  FGA_MODEL_ID: optionalText,
  AUTH0_SECRET: optionalText,
  AUTH0_BASE_URL: optionalText,
  AUTH0_ISSUER_BASE_URL: optionalText,
  AUTH0_CLIENT_ID: optionalText,
  AUTH0_CLIENT_SECRET: optionalText,
  OFRENDA_DEMO: flag.default('0'),
});

export type Env = z.infer<typeof envSchema>;

export interface Config {
  /** True when `OFRENDA_OFFLINE=1`: every cloud adapter must refuse to run (SPEC §4). */
  offline: boolean;
  /** Offline always means `ollama`: Featherless is a cloud service. */
  provider: 'featherless' | 'ollama';
  featherless: { apiKey?: string; url: string; concurrency: number };
  ollamaUrl: string;
  /** Grounded answers (Gemma). */
  model: string;
  /** Comparing tellers' versions: the strongest reasoning model. */
  deepModel: string;
  /** The calavera literaria: the strongest writer. */
  poetModel: string;
  embedModel: string;
  databaseUrl: string;
  stt: Env['OFRENDA_STT'];
  tts: Env['OFRENDA_TTS'];
  elevenlabs: { apiKey?: string; voiceId: string };
  serpapiKey?: string;
  temporalAddress: string;
  sentryDsn?: string;
  fga: { apiUrl?: string; storeId?: string; modelId?: string };
  auth0: {
    secret?: string;
    baseUrl?: string;
    issuerBaseUrl?: string;
    clientId?: string;
    clientSecret?: string;
  };
  /** True when `OFRENDA_DEMO=1`: read-only public demo, no uploads (SPEC §13). */
  demo: boolean;
}

/** Parse + validate an environment. Throws `ConfigError` on the first invalid variable. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new ConfigError(`Invalid Ofrenda configuration: ${details}`);
  }
  const e = parsed.data;
  const offline = e.OFRENDA_OFFLINE === '1';
  const provider = offline ? 'ollama' : (e.OFRENDA_PROVIDER ?? 'featherless');
  return {
    offline,
    provider,
    featherless: { apiKey: e.FEATHERLESS_API_KEY, url: e.FEATHERLESS_URL, concurrency: e.FEATHERLESS_CONCURRENCY },
    ollamaUrl: e.OLLAMA_URL,
    model: fitsProvider(provider, e.OFRENDA_MODEL) ?? PROVIDER_DEFAULTS[provider].model,
    deepModel: fitsProvider(provider, e.OFRENDA_DEEP_MODEL) ?? PROVIDER_DEFAULTS[provider].deepModel,
    poetModel: fitsProvider(provider, e.OFRENDA_POET_MODEL) ?? PROVIDER_DEFAULTS[provider].poetModel,
    embedModel: fitsProvider(provider, e.OFRENDA_EMBED_MODEL) ?? PROVIDER_DEFAULTS[provider].embedModel,
    databaseUrl: e.DATABASE_URL,
    stt: e.OFRENDA_STT,
    tts: e.OFRENDA_TTS,
    elevenlabs: { apiKey: e.ELEVENLABS_API_KEY, voiceId: e.ELEVENLABS_VOICE_ID },
    serpapiKey: e.SERPAPI_API_KEY,
    temporalAddress: e.TEMPORAL_ADDRESS,
    sentryDsn: e.SENTRY_DSN,
    fga: { apiUrl: e.FGA_API_URL, storeId: e.FGA_STORE_ID, modelId: e.FGA_MODEL_ID },
    auth0: {
      secret: e.AUTH0_SECRET,
      baseUrl: e.AUTH0_BASE_URL,
      issuerBaseUrl: e.AUTH0_ISSUER_BASE_URL,
      clientId: e.AUTH0_CLIENT_ID,
      clientSecret: e.AUTH0_CLIENT_SECRET,
    },
    demo: e.OFRENDA_DEMO === '1',
  };
}

/**
 * A model name only applies to the provider it belongs to: Featherless ids are Hugging Face repos
 * (`org/name`), Ollama tags are not. An `.env` written for one provider (OFRENDA_MODEL=gemma3:4b)
 * must not break the other, so a name that cannot belong to the active provider is ignored.
 */
function fitsProvider(provider: 'featherless' | 'ollama', name: string | undefined): string | undefined {
  if (!name) return undefined;
  const isRepo = /^[\w.-]+\/[\w.-]+$/.test(name);
  return provider === 'featherless' ? (isRepo ? name : undefined) : (isRepo ? undefined : name);
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

let cached: Config | undefined;

/** The process-wide config object, parsed on first use. */
export function getConfig(): Config {
  if (!cached) loadDotEnv();
  cached ??= loadConfig(process.env);
  return cached;
}

/** Forget the memoised config. Only for tests that set env vars mid-process. */
export function resetConfigCache(): void {
  cached = undefined;
}
