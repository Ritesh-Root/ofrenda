# T12: CI workflow and Render blueprint (no push, no deploy)

**Depends on:** T10  
**Skills to load:** ci-cd-and-automation, shipping-and-launch  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
A CI workflow ready for when the user pushes; a render.yaml for the read-only demo.

## Files you may touch
.github/workflows/ci.yml, infra/render.yaml, apps/web demo-mode guard

## Steps
1. CI: pnpm install (frozen), typecheck, unit tests (no Ollama/DB: integration suites skip), gitleaks action pinned by SHA. Validate locally with `actionlint` if available.
2. render.yaml: one web service, free plan, Node, build/start commands, env names only (OFRENDA_DEMO=1, OLLAMA_URL), health check path.
3. Demo mode: uploads disabled with copy explaining local use; ask works with OLLAMA_URL or falls back to extractive.

## Acceptance
ci.yml valid; demo build runs locally with OFRENDA_DEMO=1.

## Verify (paste real output in a kanban comment; all must pass)
```bash
OFRENDA_DEMO=1 pnpm --filter @ofrenda/web build
git remote -v | wc -l   # must print 0
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T12: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
