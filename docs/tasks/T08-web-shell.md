# T08: Web app shell: port the mockups pixel-faithfully

**Depends on:** V1  
**Skills to load:** design-taste-frontend, frontend-design, make-interfaces-feel-better  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
Next.js 16 app whose /p/rosa-mendez and /p/rosa-mendez/add look like design/mockups/index.html and add.html, rendered from DB data.

## Files you may touch
apps/web/** (app router), public/sprite.svg (copy of design/svg/sprite.svg), public/img/* (from design/assets/web)

## Steps
1. Read design/DESIGN.md and copy.md first. Copy tokens.css as-is; port ofrenda.css/add.css to CSS modules or global CSS keeping every rule. Self-host STIX Two Text with @fontsource/stix-two-text 5.3.0 (no Google Fonts).
2. Server components read person, tellers, memories, items from core queries. Story sheets: one per teller (their earliest story in full, the rest as 'Also told by' links).
3. Static demo of Ask uses the API in T9; for now keep the mockup's client-side extractive logic behind the same component.
4. Run the taste inspector on the running page; 0 FAIL required; compare to design/.taste-skill/inspect screenshots at 1440, 768, 390.

## Acceptance
Inspector 0 FAIL on both routes; screenshots match the mockups in structure, colour, type; no hard-coded colours outside tokens.css.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/web build
(cd design && CHROME_PATH=/home/ritesh/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs http://localhost:3000/p/rosa-mendez --out .taste-skill/web)
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T08: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
