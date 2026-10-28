# T17: (BLOCKED: needs credit approval) Tinker calaverita LoRA

**Depends on:** user approval  
**Skills to load:** source-driven-development, test-driven-development  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
LoRA fine-tune of Qwen3.5-4B on calaveritas literarias with a baseline-vs-tuned eval; GGUF to Ollama.

## Files you may touch
train/tinker/**

## Steps
Only after approval. Build a small dataset of public-domain calaveritas (Posada era broadsheets) plus original ones; eval rhyme rate + rubric; document cost.

## Acceptance
Eval table with real numbers.

## Verify (paste real output in a kanban comment; all must pass)
```bash
echo 'blocked until approved'
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T17: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
