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

import { z } from 'zod';

/** `'1'` enables, `'0'` disables. Everything else is a configuration error. */
const flag = z.enum(['0', '1']);

/** Trimmed text, with the empty string treated as unset (`.env.example` leaves names blank). */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

export const envSchema = z.object({
  OFRENDA_OFFLINE: flag.default('0'),
  OLLAMA_URL: z.string().trim().min(1).default('http://127.0.0.1:11434'),
  OFRENDA_MODEL: z.string().trim().min(1).default('gemma3:4b'),
  OFRENDA_EMBED_MODEL: z.string().trim().min(1).default('embeddinggemma'),
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
  ollamaUrl: string;
  model: string;
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
  return {
    offline: e.OFRENDA_OFFLINE === '1',
    ollamaUrl: e.OLLAMA_URL,
    model: e.OFRENDA_MODEL,
    embedModel: e.OFRENDA_EMBED_MODEL,
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

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

let cached: Config | undefined;

/** The process-wide config object, parsed on first use. */
export function getConfig(): Config {
  cached ??= loadConfig(process.env);
  return cached;
}

/** Forget the memoised config. Only for tests that set env vars mid-process. */
export function resetConfigCache(): void {
  cached = undefined;
}
