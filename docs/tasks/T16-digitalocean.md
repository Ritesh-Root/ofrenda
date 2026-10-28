# T16: (BLOCKED: needs spend approval) DigitalOcean GPU Gemma endpoint

**Depends on:** user approval  
**Skills to load:** source-driven-development, shipping-and-launch  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
A GPU Droplet 1-Click Gemma endpoint the Render demo's OLLAMA_URL-compatible client can use during judging, then destroyed.

## Files you may touch
docs/deploy/digitalocean.md

## Steps
Only after the user approves the cost in a comment. Document the endpoint, latency, hourly cost, and the destroy command.

## Acceptance
User approval recorded; endpoint documented.

## Verify (paste real output in a kanban comment; all must pass)
```bash
echo 'blocked until approved'
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T16: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
