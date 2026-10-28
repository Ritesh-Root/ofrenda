# T03: CLI: add, ask, altar, remember, narrate, doctor

**Depends on:** T2  
**Skills to load:** frontend-ui-engineering, test-driven-development  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
`ofrenda` command per SPEC §9, with the ANSI altar from design/cli/altar.txt.

## Files you may touch
apps/cli/src/{bin/ofrenda.ts,altar.ts,doctor.ts,format.ts} + tests

## Steps
1. commander 15.0.0. Commands per SPEC §9 (rescue is a stub that says 'available after T13').
2. altar.ts implements ART + MASK + COLOUR MAP + ANIMATION from design/cli/altar.txt exactly; item rows from DB; `--still`, NO_COLOR, non-TTY handled. Snapshot test of the still frame with NO_COLOR=1.
3. doctor.ts: Ollama reachable, each model pulled, a 1-token generate timing, free VRAM via `nvidia-smi --query-gpu=memory.used,memory.total` (absent → say so), DB extensions present, Temporal reachable, each adapter live/off/offline. Wording per design/copy.md CLI section.
4. `add` shows progress steps (copy.md progress.*); uses Temporal if reachable else run-local.

## Acceptance
All commands work against the seeded DB; `ofrenda ask "What did she cook on Sundays?"` cites m1; offline run of add+ask works.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/cli test
pnpm ofrenda doctor
pnpm ofrenda altar --still
pnpm ofrenda ask "What did she cook on Sundays?"
OFRENDA_OFFLINE=1 pnpm ofrenda add --text "She danced with every customer when a danzón came on the radio." --title "The radio" --teller chucho
OFRENDA_OFFLINE=1 pnpm ofrenda ask "What did she do when a danzón played?"
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T03: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
