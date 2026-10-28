# V2: Tier-2 verifier: durability, tracing, authz, screenshots

**Depends on:** T7, T11, T12  
**Skills to load:** verification-before-completion, webapp-testing, code-review-and-quality  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
Prove Tier 2 and collect the evidence the post needs. Reviewer, not builder.

## Files you may touch
docs/verify/V2.md, post/shots/*.png

## Steps
1. Temporal resume, Sentry no-text envelope, FGA isolation, offline e2e again, eval again.
2. Browser screenshots (Playwright Chromium at ~/.cache/ms-playwright) of: ofrenda page fold, ask answer with candles, add screen recording state, altar sheet, CLI altar (terminal screenshot or asciinema).
3. Review diff since V1 like V1 did.

## Acceptance
docs/verify/V2.md with real outputs; post/shots populated; findings fixed or filed.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm -r typecheck && pnpm -r test
ls post/shots
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`V2: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
