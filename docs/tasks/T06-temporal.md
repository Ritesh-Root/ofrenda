# T06: Temporal ingest workflow, worker, in-process fallback

**Depends on:** V1  
**Skills to load:** source-driven-development, debugging-and-error-recovery  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
Ingest is durable: a crash mid-way resumes; progress is queryable.

## Files you may touch
apps/worker/src/{workflows,activities,worker,client}.ts + tests; packages/core ingest/run-local.ts stays the fallback

## Steps
1. Read docs.temporal.io TypeScript SDK 1.25.0 (workflows, activities, queries, retries). Activities import core ingest functions.
2. Workflow `ingestMemory` per SPEC §7 with retry policies and a `progress` query.
3. Worker on task queue `ofrenda-ingest`. CLI and web start workflows through `client.ts`; if TEMPORAL_ADDRESS unreachable → run-local.
4. Test with @temporalio/testing time-skipping env: activity failure twice then success; workflow completes.
5. Manual: start ingest of the m1 WAV, kill the worker during extract, restart, workflow finishes; screenshot of Temporal UI (localhost:8233) to post/shots/temporal-resume.png.

## Acceptance
Resume demonstrated and screenshotted; tests pass; CLI still works with Temporal down.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/worker test
podman compose -f infra/compose.yaml stop temporal && pnpm ofrenda add --text "test" --title "t" --teller ana && podman compose -f infra/compose.yaml start temporal
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T06: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
