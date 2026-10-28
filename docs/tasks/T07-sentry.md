# T07: Sentry agent tracing with private data off

**Depends on:** T6  
**Skills to load:** observability-and-instrumentation, source-driven-development  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
Traces of agent, tools, model calls and ingest steps, with no prompt or story text sent.

## Files you may touch
packages/agent/src/instrument.mjs, apps/worker/src/instrument.mjs, apps/cli bootstrap, tests

## Steps
1. Read docs.sentry.io Mastra / Node agent tracing for SDK 11.10.0. Use the built-in integration; no `@mastra/sentry` exporter.
2. Turn input/output capture off for gen-AI spans (find the exact option; SPEC §12 shows the intent). Add a test that inspects an outgoing envelope via a transport stub and asserts no seed sentence appears in it.
3. Attributes: answer.mode, ofrenda.offline, gen_ai.cost.total_tokens=0 for local, ElevenLabs cost for cloud.
4. Without SENTRY_DSN nothing initialises. When OFRENDA_OFFLINE=1, Sentry is off too (it is a cloud service).
5. With the user's DSN in .env: run `ofrenda ask` 3 times and one ingest; screenshot the trace to post/shots/sentry-trace.png.

## Acceptance
Envelope test passes; screenshot saved; offline mode sends nothing.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/agent test -t sentry
OFRENDA_OFFLINE=1 pnpm ofrenda ask "What did she sing?"
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T07: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
