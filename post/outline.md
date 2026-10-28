# DEV post outline: "Ofrenda: an altar that only speaks from what your family remembers"

Writing quality is weighted most. Voice: first person plural ("we"), plain, specific, warm. Short
paragraphs. One idea per paragraph. Every number measured (see docs/verify/*.md). No hype words
("revolutionary", "seamless", "leverage", "unleash"). Spanish words unitalicised, the way a bilingual
family writes them.

Cover: design/og/dev-cover-1000x420.png. Tags: devchallenge, hf26challenge, opensource, ai.

## Opening (≈120 words): the moment, before the product
Open on the ofrenda table on 31 October: the photo, the marigolds, the bread, the candle. Then the
problem in one sentence: the stories that belong on it live in a few people's heads, and every year
someone remembers a little less. Then Ofrenda in one line. Then the rule that makes it a ghost worth
trusting: *it only answers with what the family told it, and it says who told it.*

> *This is a submission for the Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine.*
(Required line, verbatim, linked to the challenge page.)

## What I Built (≈250 words)
- Rosa (fictional, say so up front), the eight stories, four storytellers.
- The three things you can do: tell it a story (record or type), ask it, see her altar.
- The ghost-in-the-machine interpretation: not a séance chatbot that pretends to be the dead. A careful
  relative holding the family's notebook. It never says "I" as Rosa. The eeriness is the true details.
- Screenshot: the ofrenda page fold (recordatorio on rosa). Screenshot: an answer with candles.

## Demo
Video (T14) + `{{DEMO_URL}}` on the .tech domain (read-only Rosa). Note that real use is local.

## Code
GitHub embed `{% github ... %}`.

## How I Built It (≈500 words, the technical spine)
1. **Gemma on a 4 GB laptop GPU.** gemma3:4b vs gemma3:1b: measured latency per answer, eval score each.
   EmbeddingGemma 768-d. Why Gemma: open weights, runs in Ollama, good Spanish.
2. **Hybrid memory in Postgres** (Tiger Data stack): BM25 via pg_textsearch + DiskANN via pgvectorscale,
   fused with RRF in one SQL statement. Why both: names and dishes (BM25) + paraphrase across languages
   (vectors). Show the SQL (short).
3. **The guard that keeps the ghost honest.** Structured output, then a deterministic check: citations
   must be retrieved memories; no new names or numbers; else extractive fallback. Eval table (12 questions,
   4 unanswerable). This is the most important section: say what failed before the guard existed.
4. **Mastra** agent and tools. **Temporal** making slow local steps durable (kill/resume GIF).
   **Sentry** traces with prompt capture off (screenshot; latency breakdown; $0 local vs ElevenLabs cost).
5. **Family privacy**: Auth0 login + OpenFGA: same question, two relatives, different answers.
6. **Voices**: ElevenLabs Scribe for a Spanish–English recording with family names; stock narrator voice;
   why we refuse to clone the dead.
7. **Rescue a lost page**: Stagehand pulling an old archived page back into memories.
8. **Built by open models too**: Hermes Agent on DeepSeek-V4.1-Flash wrote the code from task briefs;
   what it was good at, where it needed the verifier tasks. Link `{{ENTIRE_LINK}}` (Entire checkpoints).

## Why Does Open Innovation Matter? (≈250 words)
Use docs/TRACKS.md "Why open matters", each with a concrete instance from this build (airplane-mode demo,
data never leaving, the guard we could write because we own the answer path, swapping 4b↔1b, $0 per
answer). One honest paragraph on where a closed API would have been easier (raw quality, speed) and why
we still chose open for this.

## My Agent Session
Entire checkpoints link + one excerpt explaining why a piece of code exists.

## The Spirit of It (≈150 words)
Only if real: a family member (with permission) trying it with one true story. Otherwise describe the
moment the first test answer quoted Lupita's line about the wooden spoon. End on the petal path line.

## Prize Categories
List only tracks with real work in the repo (docs/TRACKS.md), each with one line.

## Credits
Pictures (same line as the footer). Rosa is fictional; portrait is an illustration.
