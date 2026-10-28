# T11: SerpApi eraContext tool

**Depends on:** T4  
**Skills to load:** source-driven-development, security-and-hardening  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
'What was Oaxaca like in the 1950s?' gets 3 sourced facts, cached, sending only place + decade.

## Files you may touch
packages/core/src/adapters/serpapi.ts, ingest/enrich.ts, agent tools/era-context.ts, tests

## Steps
1. serpapi 2.2.1 `getJson({engine:'google', q, api_key})`; extract 3 facts with title + link from organic results; Gemma summarises each to one sentence **from the snippet only**.
2. Cache in era_context; never send names, stories or anything but `${place} ${decade}s`. Test asserts the outgoing q.
3. Offline → OfflineError; tool not registered.

## Acceptance
Facts with links stored and shown by the agent; query-content test passes.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/core test -t serpapi
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T11: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
