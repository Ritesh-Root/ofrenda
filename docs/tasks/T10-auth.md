# T10: Auth0 login and OpenFGA sharing filter on retrieval

**Depends on:** T9  
**Skills to load:** security-and-hardening, source-driven-development, test-driven-development  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
Family members sign in; a memory kept private to some relatives never reaches another relative's answer.

## Files you may touch
apps/web/middleware.ts or proxy.ts per Next 16, lib/auth0.ts, packages/core/src/authz.ts, infra/openfga/model.fga, tests

## Steps
1. Read auth0.com/ai/docs and @auth0/nextjs-auth0 4.33.0 quickstart for Next 16. With AUTH0_* unset the app runs in demo mode (SPEC §13).
2. OpenFGA model from SPEC §11; `authz.ts`: writeTuples on memory create (family or explicit users), listObjects for retrieval.
3. Add a 'Who can hear this' control to the add screen: whole family (default) or chosen relatives (storyteller chips; same visual language).
4. Tests: B cannot get A-private memory via searchMemories(allowedIds) or /api/ask; demo mode never writes tuples.

## Acceptance
Tests pass; manual check with two Auth0 test users created by the user (do not create accounts yourself; ask in a comment if none exist).

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/core test -t authz
pnpm --filter @ofrenda/web test -t auth
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T10: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
