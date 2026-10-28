# T15: DEV post draft

**Depends on:** V2  
**Skills to load:** story-writer, writing-guidelines, documentation-and-adrs  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
post/ofrenda-dev-post.md following post/outline.md and the official submission template. Writing quality is weighted most: it must read like a person who cares wrote it.

## Files you may touch
post/ofrenda-dev-post.md

## Steps
1. Use post/outline.md structure, docs/TRACKS.md 'Show it' evidence, docs/verify/*.md numbers. Real measured numbers only (latency, eval score, cost). No invented quotes or users.
2. Front matter: title, published: false, tags devchallenge, hf26challenge, opensource, ai.
3. Credit the pictures as in the footer; say Rosa is fictional.
4. Include the Entire checkpoints link placeholder `{{ENTIRE_LINK}}` and demo URL placeholder `{{DEMO_URL}}` for the user.

## Acceptance
Draft complete, every section of the template filled, every claim backed by a file in the repo.

## Verify (paste real output in a kanban comment; all must pass)
```bash
wc -w post/ofrenda-dev-post.md
grep -c '{{' post/ofrenda-dev-post.md
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T15: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
