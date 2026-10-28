# Ofrenda: rules for every agent working in this repo

You are building **Ofrenda**, a local-first digital ofrenda (Día de los Muertos altar) for the DEV
Hacktoberfest Week 4 challenge "Ghost in the Machine". Deadline: **2026-10-31 23:59 PDT**.
Read `docs/SPEC.md` before writing code, and your task brief in `docs/tasks/` before starting a task.

## Hard rules (breaking one fails the task)
1. **Never `git push`, never add a remote, never deploy.** Commit locally only. The human pushes.
2. **Never print, log, commit or paste secrets.** Keys live in `.env` (gitignored). Read them with
   `process.env`; never echo them. `.env.example` lists names with empty values.
3. **Local-first.** With `OFRENDA_OFFLINE=1` every feature that has a local path must work with the
   network unplugged, and every cloud adapter must refuse to run (throw `OfflineError`), never silently
   fall through to the network. Gemma via Ollama on `127.0.0.1:11434` is the only model in the core.
4. **The ghost never invents.** "Ask the ofrenda" answers only from retrieved memories and cites their
   ids. If retrieval finds nothing, it says so. See SPEC §6.
5. **Fictional seed data only.** `seed/abuela-rosa/` is fictional. Never add real people's data.
6. **No voice cloning of the deceased.** Narration uses stock ElevenLabs voices or the browser voice.
7. **Pin exact versions.** Run `npm view <pkg> version` before adding a dependency; use the version in
   SPEC §2 when listed. No `^` or `~` in package.json. After installing, run `pnpm audit --prod` and
   report any high/critical in your task comment.
8. **Verify against official docs** for every third-party API (Mastra, Temporal, Sentry, Auth0, OpenFGA,
   pg_textsearch, ElevenLabs, SerpApi, Stagehand). If the docs disagree with SPEC, follow the docs and
   write the difference in your task comment.
9. **Done means verified.** A task is complete only when every command under "Verify" in its brief
   passes and you pasted the real output in a kanban comment. Never claim a pass you didn't see.
10. **Stay in scope.** Touch only the files your brief names, plus tests. If something outside is broken,
    comment on the task and block it rather than fixing it silently.

## Commits
- Identity (no global git identity on this machine):
  `git -c user.name="Ritesh" -c user.email="230889855+Ritesh-Root@users.noreply.github.com" commit ...`
- Before every commit: `gitleaks git --pre-commit --staged --redact` must be clean.
- One commit per task minimum, message `T<n>: <what>`. Small, reviewable diffs.

## Stack (see SPEC §2 for versions)
pnpm workspace, TypeScript (ESM, strict), Node 26. vitest for tests. Postgres 17 with pgvector,
pgvectorscale, pg_textsearch (container `timescale/timescaledb-ha:pg17`, run with **podman**, not docker).
Ollama models: `gemma3:4b`, `gemma3:1b` (fallback), `embeddinggemma` (768-dim).
The GPU has 4 GB VRAM: never load two chat models at once; set `keep_alive` short in tests.

## Design
The UI must match `design/mockups/*.html` and use `design/tokens.css` + `design/svg/sprite.svg` as-is.
Read `design/DESIGN.md` before touching any UI. House rules there are not optional (no gradients,
no shadows, no glows, no monospace outside code, no pill badges, no icon-in-square cards).

## Commands
- `pnpm i` · `pnpm -r typecheck` · `pnpm -r test` · `pnpm -r build`
- DB: `podman compose -f infra/compose.yaml up -d` · schema: `pnpm --filter @ofrenda/core db:migrate`
- CLI (after build): `pnpm ofrenda <cmd>`
