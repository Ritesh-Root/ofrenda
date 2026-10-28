# Ofrenda

An altar that answers only with what your family remembers. A local-first digital ofrenda for
Día de los Muertos, on open-weight models (Gemma via Ollama), built for the DEV Hacktoberfest
Week 4 challenge "Ghost in the Machine".

- Product and technical spec: [docs/SPEC.md](docs/SPEC.md)
- Partner tracks: [docs/TRACKS.md](docs/TRACKS.md)
- Design system and mockups: [design/DESIGN.md](design/DESIGN.md), open `design/mockups/index.html` through a local server
- Build tasks (run by Hermes Agent): [docs/tasks/](docs/tasks/), board script [hermes/kanban.sh](hermes/kanban.sh)
- Rules for agents: [AGENTS.md](AGENTS.md)

The demo person, Rosa Elena Méndez Cruz, and her family are fictional.

## Dev quickstart

Everything runs on this machine: Podman for the services, Ollama for the models, no account needed.

```bash
# 1. Tools. Node 26, pnpm 11.19.0 (pinned in package.json `packageManager`, pnpm switches to it
#    automatically), podman, ollama.
node --version        # v26.x
pnpm --version        # 11.19.0
podman --version
ollama --version

# 2. Workspace. `pnpm i` is enough; there is no build step for the libraries (the CLI and worker run
#    their TypeScript through tsx, the web app compiles itself with Next).
pnpm i
pnpm -r typecheck
pnpm -r test

# 3. Services (db, openfga, temporal). Image tags are pinned in infra/compose.yaml.
podman compose -f infra/compose.yaml up -d
podman compose -f infra/compose.yaml ps      # all three "healthy"

# 4. Models. Sequentially — the GPU has 4 GB and should never hold two chat models at once.
ollama pull gemma3:4b
ollama pull gemma3:1b
ollama pull embeddinggemma

# 5. Config. Every name is in .env.example, with the default and a comment per line.
cp .env.example .env

# 6. Database schema, then the seed family.
pnpm --filter @ofrenda/core db:migrate
pnpm --filter @ofrenda/core seed

# 7. Use it.
pnpm ofrenda ask "¿Qué comía los domingos?"
```

No key is required. With `OFRENDA_OFFLINE=1` every cloud adapter refuses to run (`OfflineError`)
and the local path — Ollama, whisper.cpp, the browser voice — still works.

### TypeScript conventions

`tsconfig.base.json` sets `module`/`moduleResolution` to `nodenext`, the setting the TypeScript docs
recommend for modern Node ESM. Two consequences for every file you add:

- relative imports carry the `.js` extension even though the file is `.ts`:
  `import { loadConfig } from './config.js'`
- packages are imported by name (`@ofrenda/core`), never by a relative path across packages.

`apps/web` is the exception and has its own tsconfig, because Next.js compiles its own code.
