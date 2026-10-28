# V1: Tier-1 verifier: offline end to end + review

**Depends on:** T3, T5  
**Skills to load:** verification-before-completion, code-review-and-quality  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
Prove Tier 1 works offline and the diff is sound before Tier 2 starts. You are a reviewer: do not add features.

## Files you may touch
docs/verify/V1.md (your report), small fixes only if a check fails (commit as `V1: fix ...`)

## Steps
1. Fresh state: `podman compose down -v && up -d`, migrate, seed.
2. Disconnect check: run with OFRENDA_OFFLINE=1 and additionally block egress for the test process if possible (`unshare -n` for the CLI run); `ofrenda add seed/audio/m1-lupita-mole-en.wav --teller lupita` then `ofrenda ask "¿qué cocinaba los domingos?"`.
3. Run the eval; paste the table.
4. Review the whole diff since the asset-pack commit for: secrets, unpinned versions, network calls outside adapters, hallucination paths around the guard, missing tests. List findings with file:line.

## Acceptance
docs/verify/V1.md with real outputs; every finding fixed or filed as a comment; eval bar met.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm -r typecheck && pnpm -r test
OFRENDA_OFFLINE=1 unshare -rn pnpm ofrenda ask "¿qué cocinaba los domingos?" || OFRENDA_OFFLINE=1 pnpm ofrenda ask "¿qué cocinaba los domingos?"
pnpm --filter @ofrenda/core eval
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`V1: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
