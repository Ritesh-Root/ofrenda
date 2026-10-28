# T05: ElevenLabs Scribe and TTS adapters, browser voice fallback

**Depends on:** T4  
**Skills to load:** source-driven-development, security-and-hardening  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
Opt-in ElevenLabs speech-to-text (Scribe v2, keyterms) and stock-voice narration, refusing to run offline.

## Files you may touch
packages/core/src/adapters/elevenlabs.ts + test, packages/core/src/ingest/{transcribe,narrate}.ts (wire the adapter)

## Steps
1. @elevenlabs/elevenlabs-js 2.75.0; read docs for `speechToText.convert` (model `scribe_v2`, keyterms) and `textToSpeech.convert`. Voice from ELEVENLABS_VOICE_ID (default Sarah). Never a cloned voice: reject voice ids whose category is `cloned` (look it up once).
2. `assertCloudAllowed('elevenlabs')` first line of each function.
3. Test with seed/audio/m2-chucho-puesto-es.mp3 when ELEVENLABS_API_KEY is set (runIf); assert 'Mercado' and 'cacao' appear.
4. Log estimated cost (Scribe $0.22/h, TTS $0.08/1k chars per the pricing page at build time) as a number the Sentry task can attach.

## Acceptance
Transcribes the Spanish seed with names right; narration produces an mp3; offline mode throws OfflineError with no request.

## Verify (paste real output in a kanban comment; all must pass)
```bash
pnpm --filter @ofrenda/core test -t elevenlabs
OFRENDA_OFFLINE=1 pnpm --filter @ofrenda/core test -t elevenlabs
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T05: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
