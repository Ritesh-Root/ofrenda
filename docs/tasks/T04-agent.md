# T04: Mastra agent with tools, Postgres memory, grounded citations

**Depends on:** T2  
**Skills to load:** source-driven-development, api-and-interface-design, test-driven-development  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
The Mastra agent of SPEC §8, used by answer.ts, with every answer passing the §6 guard.

## Files you may touch
packages/agent/src/{mastra,ofrenda-agent}.ts, tools/{search-memories,list-items,era-context}.ts, tests

## Steps
1. Read mastra.ai docs: Agent, createTool, Memory with @mastra/pg PostgresStore, using an AI SDK provider model (ollama-ai-provider-v2). Confirm compatibility of AI SDK 6 models with @mastra/core 1.80.0; if incompatible, write the finding in a task comment and use the closest supported path (do not upgrade `ai` to 7: it breaks Auth0).
2. Tools are thin wrappers over core functions; `eraContext` only registered when not offline and SERPAPI_API_KEY is set.
3. answer.ts gets an `engine: 'agent'|'direct'` option; default `agent`; guard runs after either.
4. Run the eval with engine=agent; report the table.

## Acceptance
Eval bar met with the agent engine; thread memory persisted in Postgres; no tool registered that needs the network when offline.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/agent test
OFRENDA_ENGINE=agent pnpm --filter @ofrenda/core eval
OFRENDA_OFFLINE=1 pnpm --filter @ofrenda/agent test -t offline
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T04: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
