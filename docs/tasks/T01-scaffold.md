# T01: Scaffold the workspace, services and models

**Depends on:** —  
**Skills to load:** incremental-implementation, source-driven-development  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
A pnpm TypeScript workspace that installs, typechecks and tests; Postgres, OpenFGA and Temporal running in podman; Gemma models pulled.

## Files you may touch
package.json, pnpm-workspace.yaml, tsconfig.base.json, vitest.config.ts, .gitignore (exists, keep), .env.example, .npmrc (save-exact=true), packages/core|agent|rescue/package.json + tsconfig + src/index.ts, apps/cli|web|worker/package.json + tsconfig, infra/compose.yaml, README.md (dev quickstart section only)

## Steps
1. `git log` shows the asset-pack commit already; build on it.
2. Root package.json: `"type":"module"`, `"packageManager":"pnpm@11.19.0"`, scripts `typecheck`, `test`, `build`, `ofrenda` (runs apps/cli). Dev deps pinned: typescript 6.0.3, vitest 5.0.5, @types/node (check version).
3. Workspace packages named `@ofrenda/core`, `@ofrenda/agent`, `@ofrenda/rescue`, `@ofrenda/cli`, `@ofrenda/web`, `@ofrenda/worker`. Strict TS, ESM, `moduleResolution: bundler` or `nodenext` (pick one, consistently).
4. infra/compose.yaml: services `db` (timescale/timescaledb-ha:pg17, user/pass/db `ofrenda`, port 5432, named volume), `openfga` (openfga/openfga, `run`, port 8080, memory datastore is fine for dev), `temporal` (temporalio/temporal, `server start-dev --ip 0.0.0.0`, ports 7233 and 8233). Pin every image to the exact tag you pulled (`podman image inspect`).
5. `podman compose -f infra/compose.yaml up -d`; confirm `create extension vectorscale cascade; create extension pg_textsearch;` work in the db container (psql via `podman exec`).
6. `ollama pull gemma3:4b gemma3:1b embeddinggemma` (sequentially).
7. .env.example: every env name from SPEC §4 with empty or default values, comment per line.
8. One smoke test in packages/core (`src/index.test.ts`) so `pnpm -r test` runs.

## Acceptance
`pnpm i` clean; `pnpm -r typecheck` and `pnpm -r test` pass; three containers healthy; three models listed by `ollama list`; image tags pinned.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm i --frozen-lockfile
pnpm -r typecheck && pnpm -r test
podman compose -f infra/compose.yaml ps
podman exec $(podman ps -qf name=db) psql -U ofrenda -d ofrenda -c "create extension if not exists vectorscale cascade; create extension if not exists pg_textsearch; select extname from pg_extension;"
ollama list | grep -E 'gemma3:4b|gemma3:1b|embeddinggemma'
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T01: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
