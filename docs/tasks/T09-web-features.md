# T09: Web features: ask (streaming), add with recording, remembrance, motion

**Depends on:** T8  
**Skills to load:** frontend-ui-engineering, motion-design, web-design-guidelines  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
The live thing works: ask with citations, record or type a memory with progress, narrate.

## Files you may touch
apps/web/app/api/{ask,memories}/**, components for Ask, Recorder, Progress, Narrate

## Steps
1. /api/ask → core answer.ts; render answer with the materialise animation and candle citations linking to the story sheet anchor.
2. /p/[id]/add: MediaRecorder → upload → ffmpeg to 16 kHz WAV → workflow; progress via polling the progress endpoint; 'What the ofrenda heard' shows extracted items with Keep / Remove before saving items.
3. STT choice radio: ElevenLabs option disabled with copy.md add.offline when offline.
4. Read aloud: speechSynthesis (es-MX/en-US by detected language); ElevenLabs only if OFRENDA_TTS=elevenlabs.
5. Motion per DESIGN.md; everything visible without JS and under reduced motion.

## Acceptance
Full flow works in the browser on the seeded DB, offline included; inspector still 0 FAIL.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/web test
OFRENDA_OFFLINE=1 pnpm --filter @ofrenda/web build && echo build-ok
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T09: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
