# T14: Demo video with narration

**Depends on:** V2  
**Skills to load:** ai-narrated-video, product-video-script  
**Read first:** AGENTS.md, docs/SPEC.md (sections named below), design/DESIGN.md for any UI.

## Goal
A 75–100 s demo video following post/storyboard.md, exported to ~/Downloads/ofrenda-demo.mp4.

## Files you may touch
post/video/** (sources), output to ~/Downloads

## Steps
1. Follow post/storyboard.md shot by shot; use post/shots and live captures.
2. Narration with ElevenLabs stock voice (script in storyboard), ambient from seed/audio/sfx-*.mp3 at low level.
3. Captions burned in (en). No music with lyrics.

## Acceptance
mp4 in ~/Downloads, 1080p, ≤ 100 s, captions readable on a phone.

## Verify (paste real output in a kanban comment; all must pass)
```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 ~/Downloads/ofrenda-demo.mp4
pnpm -r typecheck
git status --short   # only files this brief names, plus tests
gitleaks git --pre-commit --staged --redact
```

## Then
Commit locally (`T14: <what>`, identity from AGENTS.md). Do not push. Mark the task complete only after the Verify block passes.
