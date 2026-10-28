# T02: Core: schema, hybrid search, ingest activities, prompts, offline guard

**Depends on:** T1  
**Skills to load:** test-driven-development, codebase-design, source-driven-development  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
`@ofrenda/core` holds everything both the CLI and web need: config, offline guard, model access, DB schema and queries, hybrid search with RRF, ingest activity functions, prompts, whisper adapter, seed loader.

## Files you may touch
packages/core/src/{config,offline,model,search,answer,seed}.ts, db/{schema.sql,migrate.ts,queries.ts}, ingest/{transcribe,save,embed,extract,remembrance,run-local}.ts, prompts/{extract,answer,remembrance}.ts, adapters/whisper.ts, and *.test.ts beside each

## Steps
1. config.ts per SPEC §4 (zod). offline.ts per SPEC §4 with its no-network test.
2. model.ts: `createOllama({ baseURL: OLLAMA_URL + '/api' })` from ollama-ai-provider-v2 3.6.0; `chat()`, `embedMany(texts, kind:'query'|'document')` with EmbeddingGemma's prompt prefixes (read the model card on ollama.com/library/embeddinggemma and cite it in a comment).
3. schema.sql exactly as SPEC §5 (verify pg_textsearch syntax in Tiger docs first). migrate.ts applies it idempotently. `pnpm --filter @ofrenda/core db:migrate`.
4. search.ts: BM25 top 20 + vector top 20 + RRF (k=60) in **one** SQL statement with CTEs; `allowedIds` filter inside SQL. Tests on the seed: 'mole domingos' → m1 first; 'canción' → m3 first.
5. seed.ts loads seed/abuela-rosa (person, tellers, stories as memories with source 'seed', items + mentions), embedding every story.
6. ingest activities as plain async functions (SPEC §7) — no Temporal imports in core. extract uses `generateObject` with a zod schema; golden-file recall test ≥ 70% against ofrenda-items.json (skip in CI when Ollama is absent, using `describe.runIf`).
7. answer.ts per SPEC §6 including the deterministic guard and extractive fallback (port `bestSentences` from design/mockups/ask.js). Eval runner `pnpm --filter @ofrenda/core eval` over seed/abuela-rosa/eval.json printing a table and the pass bar.
8. adapters/whisper.ts with nodejs-whisper 0.4.1 (model `base`); transcribe seed/audio/m1-lupita-mole-en.wav in a test (runIf whisper is built).

## Acceptance
Unit tests pass without Ollama (pure functions mocked); integration tests pass with Ollama + DB up; eval meets the SPEC §6 bar on gemma3:4b **or** gemma3:1b (report both if time allows, with timings).

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/core test
pnpm --filter @ofrenda/core db:migrate && pnpm --filter @ofrenda/core seed
pnpm --filter @ofrenda/core eval
OFRENDA_OFFLINE=1 pnpm --filter @ofrenda/core test -t offline
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T02: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
