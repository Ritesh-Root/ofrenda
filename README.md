# Ofrenda

**An altar that answers only with what your family remembers, says who remembered it, and keeps both
versions when two people remember differently.** A Día de los Muertos memory keeper built on open-weight
models, for the DEV Hacktoberfest Open-Source AI Challenge, Week 4: *Ghost in the Machine*.

The demo person, Rosa Elena Méndez Cruz (1938–2019), and her family are fictional.

## What it does
- **Ask her ofrenda**, typed or out loud. Answers come only from the family's stories, with a candle by each
  relative it quotes. A deterministic guard throws away any answer that cites a story it wasn't given or names
  someone nobody mentioned, and quotes the family directly instead.
- **Two tellers, two truths.** When Lupita says the stall opened in 1959 and Tío Chucho says 1961, both appear
  side by side. The ofrenda doesn't decide.
- **Nobody told it?** It names the relative most likely to know, with a button to record their answer.
- **Her calavera.** A *calavera literaria*, the rhyming Día de los Muertos verse in which La Catrina comes for
  someone, written from the family's own details and set as a Posada broadsheet.
- **A voice, never hers.** ElevenLabs Scribe hears questions and recordings (it is told the family's names);
  a stock ElevenLabs narrator reads answers aloud, and the candle flames move with the voice. Cloned voices
  are refused in code.

## Models (open weights, one job each)
| Job | Model |
|---|---|
| Grounded answers | `google/gemma-4-31B-it` |
| Comparing tellers, writing the calavera | `deepseek-ai/DeepSeek-V4.1-Flash-1017` (reasoning off) |
| Retrieval | `Qwen/Qwen3-Embedding-8B` (768-d Matryoshka cut) + BM25 in Postgres, fused with RRF |

Served by Featherless by default. `OFRENDA_PROVIDER=ollama` runs Gemma 3 and EmbeddingGemma on your own
machine instead (measured 11/12 on the honesty eval on a 4 GB laptop GPU).

## Run it
```bash
pnpm i
podman compose -f infra/compose.yaml up -d db        # Postgres 17 + pgvector + pgvectorscale + pg_textsearch
cp .env.example .env                                  # add FEATHERLESS_API_KEY and ELEVENLABS_API_KEY
pnpm --filter @ofrenda/core seed                      # Rosa's ten stories, embedded
pnpm --filter @ofrenda/web start                      # http://127.0.0.1:4321
pnpm --filter @ofrenda/core eval                      # the 12-question honesty eval
```

## Honesty eval (`seed/abuela-rosa/eval.json`)
12 questions, 4 of them unanswerable. Gemma 4 31B: **12/12** found correctly, citations 100% valid,
**0** invented names or numbers. Gemma 3 4B locally: 11/12.

## Built with
- Workspace and core (config, offline guard, schema, hybrid search, grounded answer, ingest) written by
  **Hermes Agent** on DeepSeek-V4.1-Flash from the task briefs in `docs/tasks/`.
- Design system and mockups: `design/` (see `design/DESIGN.md`). Picture credits are in the page footer.

MIT licensed.
