# T13: Stagehand: rescue a lost page from web.archive.org

**Depends on:** V2  
**Skills to load:** source-driven-development, browser-testing-with-devtools  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
`ofrenda rescue <web.archive.org URL> --teller <id>` turns an archived personal page into memories (source 'archive').

## Files you may touch
packages/rescue/** (own package.json with zod 4.4.3 pinned for Stagehand's types), apps/cli rescue command

## Steps
1. @browserbasehq/stagehand 4.3.0 with a local browser; model: custom `model.generate` that calls Ollama's OpenAI-compatible /v1 endpoint with gemma3 (docs.stagehand.dev/v4/configuration/models). Browserbase cloud browser only if BROWSERBASE_API_KEY set and not offline.
2. `extract` the page's posts (title, date, text) with a zod schema; each becomes a memory through the normal ingest.
3. Use a public-domain or user-provided archived page for the demo; do not scrape personal data of real people. Default demo URL: ask the user in a comment.

## Acceptance
One archived page rescued into memories and answerable by ask.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/rescue test
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T13: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
