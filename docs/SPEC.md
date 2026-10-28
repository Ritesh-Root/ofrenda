# Ofrenda: product and technical spec

## 1. What it is
A digital ofrenda for one person who has died. The family records or types stories about them.
Ofrenda transcribes each story, extracts what belongs on the altar (foods, songs, places, sayings,
rituals), drafts a remembrance, and lets anyone in the family **ask the ofrenda** questions, which it
answers **only** from the stories, citing who told them. Everything runs on the family's own laptop
on open-weight models (Gemma via Ollama). Cloud partners are opt-in adapters, never required.

Demo person: **Rosa Elena Méndez Cruz (1938–2019)**, fictional, in `seed/abuela-rosa/`.
UI reference: `design/mockups/index.html` (the ofrenda page), `design/mockups/add.html` (add a memory),
`design/cli/altar.txt` (CLI altar). Tokens: `design/tokens.css`. Drawings: `design/svg/sprite.svg`.

## 2. Stack and pinned versions (checked 2026-10-29 with `npm view`)
| Package | Version | Where |
|---|---|---|
| typescript | 6.0.3 (not 7.x: the Go rewrite; avoid tooling surprises) | root |
| vitest | 5.0.5 | root |
| zod | 4.6.7 (Stagehand package pins its own `zod@4.4.3`, see T13) | core |
| ai | 6.0.317 (**not 7**: `@auth0/ai-vercel` needs ai 5 or 6) | core |
| ollama-ai-provider-v2 | 3.6.0 (**not 4.x**, which needs ai 7) | core |
| pg | 8.23.1 | core |
| @mastra/core / @mastra/memory / @mastra/pg | 1.80.0 / 1.39.1 / 1.33.0 | agent |
| @mastra/observability | 1.22.0 | agent |
| commander | 15.0.0 | cli |
| nodejs-whisper | 0.4.1 | core (local STT) |
| @elevenlabs/elevenlabs-js | 2.75.0 | core (adapter) |
| serpapi | 2.2.1 | core (adapter) |
| @temporalio/client, worker, workflow, activity | 1.25.0 | worker |
| @sentry/node | 11.10.0 | agent, worker, cli |
| next | 16.4.3 | web |
| @auth0/nextjs-auth0 | 4.33.0 | web |
| @openfga/sdk | 0.9.7 | core (authz) |
| @fontsource/stix-two-text | 5.3.0 | web (self-hosted font, works offline) |
| @browserbasehq/stagehand | 4.3.0 | rescue (T13) |

Containers (podman): `docker.io/timescale/timescaledb-ha:pg17` (pgvector + pgvectorscale +
pg_textsearch), `docker.io/openfga/openfga:latest` → pin the tag you pull, `docker.io/temporalio/temporal`
→ pin the tag; command `server start-dev --ip 0.0.0.0` (UI on :8233, gRPC :7233).

Ollama: `gemma3:4b` (3.4 GB), `gemma3:1b` (0.8 GB), `embeddinggemma` (622 MB, 768-d). Local Ollama is
0.33.3. The GPU is 4 GB and other apps use ~2.7 GB, so `gemma3:4b` partly runs on CPU: correct but
slow. `ofrenda doctor` reports free VRAM and recommends `OFRENDA_MODEL=gemma3:1b` when free < 3.6 GB.

## 3. Repo layout
```
packages/core      config.ts, offline.ts, model.ts, db/ (schema.sql, migrate.ts, queries.ts),
                   search.ts (hybrid + RRF), ingest/ (activities), prompts/, answer.ts (grounded answer),
                   adapters/ (whisper.ts, elevenlabs.ts, serpapi.ts), authz.ts (OpenFGA), seed.ts
packages/agent     mastra.ts (Mastra instance), ofrenda-agent.ts, tools/, instrument.mjs (Sentry)
packages/rescue    Stagehand "rescue a lost page" (T13), own zod pin
apps/cli           bin/ofrenda.ts (commander), altar.ts (renderer from design/cli/altar.txt)
apps/web           Next.js App Router; implements design/mockups
apps/worker        Temporal worker + ingest workflow
infra/             compose.yaml, openfga/model.fga, render.yaml
seed/              abuela-rosa/*.json, audio/*
design/            the asset pack (read-only for builders unless a task says otherwise)
docs/              SPEC.md (this), TRACKS.md, tasks/
```

## 4. Configuration (`packages/core/src/config.ts`, validated with zod)
| Env | Default | Meaning |
|---|---|---|
| OFRENDA_OFFLINE | `0` | `1` disables every cloud adapter (they throw `OfflineError`) |
| OLLAMA_URL | `http://127.0.0.1:11434` | Ollama |
| OFRENDA_MODEL | `gemma3:4b` | chat model |
| OFRENDA_EMBED_MODEL | `embeddinggemma` | embedding model, 768-d |
| DATABASE_URL | `postgres://ofrenda:ofrenda@127.0.0.1:5432/ofrenda` | Postgres |
| OFRENDA_STT | `local` | `local` (whisper.cpp) or `elevenlabs` |
| OFRENDA_TTS | `browser` | `browser`, `elevenlabs`, or `none` |
| ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID | — | stock voice only (default Sarah `EXAVITQu4vr4xnSDxMaL`) |
| SERPAPI_API_KEY | — | era context |
| TEMPORAL_ADDRESS | `127.0.0.1:7233` | if unreachable, ingest runs in-process |
| SENTRY_DSN | — | tracing off when unset |
| FGA_API_URL, FGA_STORE_ID, FGA_MODEL_ID | — | sharing filter off when unset (everyone in the family sees all) |
| AUTH0_* | — | web login; unset → web runs in demo mode (read-only, seeded) |
| OFRENDA_DEMO | `0` | `1` = read-only public demo (Render) |

`offline.ts`: `assertCloudAllowed(name)` throws `OfflineError(name)` when offline. Every adapter calls it
first. Test: with `OFRENDA_OFFLINE=1`, calling each adapter throws and makes **no** network request
(stub `fetch` to fail the test if called).

## 5. Data model (`packages/core/src/db/schema.sql`)
```sql
create extension if not exists vector;
create extension if not exists vectorscale cascade;
create extension if not exists pg_textsearch;

create table people (
  id text primary key, name text not null, short_name text not null,
  born_year int, died_year int, born_place text, data jsonb not null default '{}'
);
create table tellers (
  id text primary key, person_id text not null references people(id) on delete cascade,
  name text not null, relation text not null, hue int not null
);
create table memories (
  id text primary key, person_id text not null references people(id) on delete cascade,
  teller_id text references tellers(id), title text not null, lang text not null check (lang in ('es','en','mixed')),
  year int, body text not null, source text not null check (source in ('seed','typed','audio','archive')),
  audio_path text, created_at timestamptz not null default now(), embedding vector(768)
);
-- bilingual corpus: 'simple' config avoids English-only stemming on Spanish text
create index memories_bm25 on memories using bm25 (body) with (text_config = 'simple');
create index memories_vec on memories using diskann (embedding vector_cosine_ops);

create table ofrenda_items (
  id text primary key, person_id text not null references people(id) on delete cascade,
  kind text not null check (kind in ('food','song','place','saying','ritual','photo','date')),
  name text not null, note text
);
create table item_mentions (
  item_id text references ofrenda_items(id) on delete cascade,
  memory_id text references memories(id) on delete cascade,
  primary key (item_id, memory_id)
);
create table remembrances (
  id bigserial primary key, person_id text not null references people(id) on delete cascade,
  body text not null, model text not null, memory_ids text[] not null, created_at timestamptz not null default now()
);
create table era_context (  -- SerpApi results, cached; only place + decade were sent
  place text not null, decade int not null, facts jsonb not null, fetched_at timestamptz not null default now(),
  primary key (place, decade)
);
```
Verify the pg_textsearch index syntax and the BM25 operator (`<@>`, lower is better) in the Tiger docs
before writing queries; adjust if the docs differ.

**Hybrid search** (`search.ts`, `searchMemories(personId, query, k=6, allowedIds?)`): run BM25 top 20 and
vector top 20 (query embedded with EmbeddingGemma using the `search_query: ` / document prefixes that the
EmbeddingGemma model card prescribes; check it), fuse with Reciprocal Rank Fusion
`score = Σ 1/(60 + rank)`, return top k with `{id,title,teller,year,body,score}`. `allowedIds` (from FGA)
filters inside SQL (`and id = any($n)`), never after.

## 6. The grounded answer (`answer.ts`), the ghost never invents
1. `hits = searchMemories(...)`. If `hits` is empty or the best RRF score < threshold (tune on seed; start
   at 0.02) → return `{found:false}` → UI says "Nobody in her family has told the ofrenda about that yet."
2. Ask Gemma with `generateObject` (Ollama structured output) for
   `{ found: boolean, answer: string, citations: string[] }`, prompt in `prompts/answer.ts`:
   answer in the question's language, 1–3 sentences, quote the family's words where possible, only facts
   present in the given memories, cite memory ids.
3. **Guard** (deterministic, no model): drop citations not in `hits`; if none remain, or the answer
   mentions a capitalised name / number not present in the cited bodies, fall back to the **extractive**
   answer: the best 1–2 sentences from the top memory (same algorithm as `design/mockups/ask.js`
   `bestSentences`). Log which path ran (`answer.mode = model|extractive|none`) as a Sentry span attribute.
4. Return `{found, answer, citations:[{id,title,teller}] , mode}`.
Tests: seed questions in `seed/abuela-rosa/eval.json` (create it: 12 questions, expected memory ids,
4 of them unanswerable). Pass bar: ≥10/12 correct `found`, 100% of citations valid, 0 invented names.

## 7. Ingest pipeline (activities in `packages/core/src/ingest/`, orchestrated by Temporal in `apps/worker`)
`ingestMemory({personId, tellerId, title?, text?, audioPath?, lang?, stt})`:
1. `transcribe` (audio only): local whisper.cpp (`nodejs-whisper`, model `base`; `small` if CPU allows),
   or ElevenLabs Scribe v2 with `keyterms` = family names + item names. → `{text, lang}`.
2. `saveMemory` → row in `memories`.
3. `embedMemory` → EmbeddingGemma vector.
4. `extractItems` → Gemma structured output `{items:[{kind,name,note}]}`; upsert `ofrenda_items` by
   normalised name; insert `item_mentions`. Golden file: `seed/abuela-rosa/ofrenda-items.json` (test recall
   ≥ 70% on seed stories, by fuzzy name match).
5. `draftRemembrance` (optional flag) → 120–180 words, warm, second person plural, cites nothing invented.
6. `enrichEra` (optional, cloud): SerpApi `google` engine `q="<place> <decade>s"` → 3 facts with source
   URLs → `era_context`. Only place + decade leave the machine.
7. `narrate` (optional): ElevenLabs TTS with a stock voice → `seed/audio`-like path, or skip.
Retry policy: model activities `startToCloseTimeout: '10 minutes'`, `maximumAttempts: 3`; cloud adapters
`maximumAttempts: 5` with backoff. The workflow exposes a query `progress` → `{step, done[]}` for the UI.
**In-process fallback** (`ingest/run-local.ts`): same activity functions run sequentially when Temporal
is unreachable, so the CLI works with no extra services.

## 8. Agent (Mastra, `packages/agent`)
`ofrendaAgent = new Agent({ id:'ofrenda', model: ollama(OFRENDA_MODEL), tools:{searchMemories,
listOfrendaItems, eraContext}, memory: new Memory({ storage: PostgresStore }) })`. Instructions: you are
the ofrenda of <name>; answer only from tool results; cite memory ids; never speak as the deceased; if
nothing found, say so. The web chat and `ofrenda ask` call `answer.ts` (which may call the agent);
the guard in §6 runs after the agent either way. `eraContext` is not registered when offline.

## 9. CLI (`apps/cli`, bin `ofrenda`)
| Command | Does |
|---|---|
| `ofrenda init [--seed rosa]` | migrate DB, load seed (people, tellers, stories with embeddings, items) |
| `ofrenda add <audio.wav|mp3> --teller <id> [--stt local|elevenlabs]` / `ofrenda add --text "…" --title "…" --teller <id>` | ingest one memory, show progress steps |
| `ofrenda ask "<question>" [--person rosa-mendez]` | grounded answer + citations (who told it, title) |
| `ofrenda altar [--still]` | ANSI altar per `design/cli/altar.txt` |
| `ofrenda remember` | draft and print a remembrance |
| `ofrenda narrate [--out file]` | narrate the latest remembrance (browser TTS isn't available in CLI → ElevenLabs or none) |
| `ofrenda doctor` | Ollama up? models pulled? free VRAM? DB extensions? Temporal? which adapters live/offline |
| `ofrenda rescue <archive-url>` | T13: pull an old page from web.archive.org into memories |
Output style: plain sentences, colours from the CLI colour map, no emoji, no spinners that hide errors.

## 10. Web (`apps/web`, Next.js App Router)
Routes: `/` → redirect to `/p/rosa-mendez`; `/p/[id]` → the ofrenda page (mockup `index.html`, data from
DB); `/p/[id]/add` → add a memory (mockup `add.html`); `/api/ask` POST `{personId, q}` → JSON answer
(stream optional); `/api/memories` POST multipart (audio or text) → start workflow, returns id;
`/api/memories/[id]/progress` GET. Recording uses `MediaRecorder` → webm → server converts with ffmpeg to
16 kHz WAV. "Read the answer aloud" uses `speechSynthesis`; ElevenLabs only when `OFRENDA_TTS=elevenlabs`.
Self-host the font with `@fontsource/stix-two-text` (no Google Fonts at runtime: offline).
Auth: Auth0 login when `AUTH0_*` set; otherwise demo mode. Every API route resolves the user, then FGA
`listObjects(user, 'viewer', 'memory')` → `allowedIds` for search.

## 11. Authorization (OpenFGA, self-hosted container)
`infra/openfga/model.fga`:
```
model
  schema 1.1
type user
type family
  relations
    define member: [user]
type memory
  relations
    define viewer: [user, family#member]
```
A memory shared with the family gets the tuple `family:mendez#member viewer memory:<id>`. A memory kept
private to some relatives gets one `user:<id> viewer memory:<id>` tuple per allowed person and **no** family
tuple. The teller is always a viewer. Test: user B cannot retrieve a memory private to A, through search
**and** through `/api/ask`.

## 12. Observability (Sentry, `instrument.mjs`)
`Sentry.init({ dsn, tracesSampleRate: 1.0, dataCollection: { genAI: { inputs: false, outputs: false } } })`
(verify the option name in Sentry docs; the intent: **no prompt or story text leaves the machine**).
Mastra/AI SDK spans come from Sentry's built-in integration (SDK 11): do **not** add `@mastra/sentry`'s
exporter. Add span attributes: `answer.mode`, `ofrenda.offline`, `gen_ai.cost.total_tokens = 0` for local
models (Sentry can't price local models), and the ElevenLabs cost estimate for cloud calls.

## 13. Demo mode and hosting
`OFRENDA_DEMO=1`: read-only, seeded Rosa, `/api/ask` works on a server-side Gemma endpoint
(`OLLAMA_URL` pointed at a GPU host, see T16) or falls back to the extractive answer; uploads disabled with
a sentence explaining that real use runs on your own laptop. `infra/render.yaml` describes the web
service (free plan, `buildCommand`, `startCommand`, env names without values). **Do not deploy.**
