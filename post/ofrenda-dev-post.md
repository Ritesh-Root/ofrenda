---
title: Lupita says 1959. Tío Chucho says 1961. The ofrenda keeps both.
published: false
tags: devchallenge, hf26challenge, opensource, ai
cover_image: {{COVER_IMAGE_URL}}
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26)*

![Two relatives remember the same year differently, and the ofrenda shows both](https://{{GIF_URL}})

Every family has the argument. Somebody says the stall opened in 1959, the year they rebuilt the market roof. Somebody else, who was nine at the time and has never once conceded a point, says 1961. They have it every November, at the same table, in front of the same photograph.

The grandmother they are arguing about is the only one who knew, and she is the reason they are at the table.

So when I built an ofrenda that answers questions about someone who has died, I gave it one rule I care about more than any other: **it is not the ofrenda's place to decide.** It answers only with what the family told it. It says who told it. When nobody told it, it says so and tells you who to ask. And when two people remember it differently, it shows both, side by side, with their names on them.

## What I Built

**Ofrenda** is a digital altar for one person who has died. The family records or types stories about her, in Spanish, English, or both in one breath. Then anyone can sit in front of it and ask.

The demo ofrenda belongs to **Rosa Elena Méndez Cruz (1938–2019)**, who sold chocolate from the same stall in Oaxaca's Mercado 20 de Noviembre for forty-three years. Rosa and her four storytellers are fictional; I wrote their ten stories so the demo has no real family's data in it. Everything the ofrenda does with them is real.

![Rosa's ofrenda: a memorial card under papel picado](https://{{SCREENSHOT_HERO}})

You can:

- **Ask her ofrenda**, typed or out loud. *"What did she cook on Sundays?"* gets Lupita's mole negro, started before the seven o'clock bells at Santo Domingo, with a small candle next to *Guadalupe (Lupita), in "Mole on Sundays."*
- **Hear the two truths.** *"When did she open the chocolate stall?"* gets both: Lupita's *"she opened her chocolate stall in 1959"* in her color, and Tío Chucho's *"Rosa abrió su puesto en el Mercado 20 de Noviembre en 1961"* in his. *The ofrenda keeps both. It is not its place to decide.*
- **Be sent to a living person.** *"What was her husband's name?"* Nobody told it. Instead of guessing, it says *Ask Lupita, her daughter*, names the story of hers that came closest, and offers a button: **Record Lupita's answer**. The ofrenda's blank spaces become a to-do list for the next family dinner.
- **Read her calavera.** A *calavera literaria* is the rhyming Día de los Muertos verse, printed on Posada's broadsheets since the 1890s, in which La Catrina comes to take someone and gets teased with their own habits. Ofrenda writes Rosa's from the family's details and sets it as a broadsheet:

> *«Rosa, ven», le dijo quedo, / «que ya es hora de partir». / Y Rosa, sin apurarse, / le contestó: «Hay más tiempo que vida, mija, déjame seguir».*
>
> "Rosa, come," she said softly, "for it is time to depart." And Rosa, without hurrying, answered: "There is more time than life, my dear, let me go on."

"Hay más tiempo que vida" is what Tío Chucho remembers her saying every time they were late for mass. The verse is the family's own sentence, handed back to them in La Catrina's mouth.

- **Hear it.** Answers and the calavera are read aloud by a narrator voice, and the candle flames on the page flicker with the loudness of that voice.

That's my reading of *Ghost in the Machine*: not a ghost that pretends to be Rosa, but a careful relative holding the family's notebook. It never says "I" as her. The eeriness comes from the true details.

## Demo

{% embed {{YOUTUBE_URL}} %}

The video is 73 seconds. Every answer in it is a real response from the running app, captured by a headless browser while the models answered.

## Code

{% embed https://github.com/{{GITHUB_REPO}} %}

```bash
pnpm i
podman compose -f infra/compose.yaml up -d db   # Postgres 17 + pgvector + pgvectorscale + pg_textsearch
cp .env.example .env                             # FEATHERLESS_API_KEY, ELEVENLABS_API_KEY
pnpm --filter @ofrenda/core seed && pnpm --filter @ofrenda/web start
```

## How I Built It

### One open model per job

| Job | Model | Why |
|---|---|---|
| Answering questions | **Gemma 4 31B** (`google/gemma-4-31B-it`) | Strong multilingual reading, follows "only from these memories" well |
| Comparing tellers, writing the calavera | **DeepSeek V4.1 Flash** (`deepseek-ai/DeepSeek-V4.1-Flash-1017`) | Fast, good Spanish verse, reliable structured output with reasoning off |
| Finding the stories | **Qwen3 Embedding 8B** + BM25 | Bilingual retrieval: names and dishes match by keyword, paraphrases match by meaning |

All three are open weights, served by [Featherless](https://featherless.ai). The same code runs them on your own machine with Ollama by changing one variable, `OFRENDA_PROVIDER=ollama` (more on that below).

Retrieval is one SQL statement in Postgres: BM25 from `pg_textsearch` and vector search from `pgvectorscale`'s DiskANN index, fused with Reciprocal Rank Fusion. Hybrid matters here because families mix languages. "¿Qué cocinaba los domingos?" has to find a story written in English about mole on Sundays, and "chilhuacles" has to match the one story that contains it.

### The guard that keeps the ghost honest

Gemma writes the answer as structured output: `{found, answer, citations}`. Then plain code, no model, checks it:

1. Every citation must be a memory that retrieval actually returned.
2. Every capitalised name and every number in the answer must appear in the cited stories, or be the person's or a teller's name.
3. If either check fails, the model's words are thrown away and the ofrenda **quotes the family directly** instead, picking the two sentences of the best story that overlap the question most.

Building it taught me where "never invent" gets hard:

- **The first version flagged "Guadalupe" as invented.** Gemma had correctly written "Guadalupe (Lupita) states that her mother opened her chocolate stall in 1959", but the guard only knew Rosa's name. Attribution isn't invention, so tellers' names are allowed now.
- **Spanish answers about English stories always failed.** "Cocinaba mole negro…" starts with a capital letter that appears in no English story. A capital at the start of a sentence is grammar, not a name, so the guard now skips it.

### Two tellers, two truths

After retrieval, DeepSeek gets one narrow question: *do these memories, told by different relatives, disagree about what was asked?* It returns the versions with memory ids. Then code checks each one:

- the memory was retrieved,
- the tellers are different people,
- at least 60% of the quoted words appear in that teller's memory.

The last check caught a quiet failure. Sometimes the model paraphrased Ana's Spanish into English ("Ana Sofía says Mateo claims…"), and the guard rightly couldn't find those words in her story, so the disagreement vanished. The fix was in the prompt (*copy their words verbatim, in the memory's own language*) and in the guard (*ignore the teller's name and words like "says"*). After that it found both seeded disagreements in 4 runs out of 4, and raised no false conflict on the mole question.

### When the biggest models wrote nothing

I wanted the strongest open model for the calavera, so I tried the newest flagships on Featherless first:

| Model | What happened |
|---|---|
| Qwen3.8 2.4T | 90 s, no verse. Featherless rejects requests that turn its reasoning off. |
| Kimi K3 | 88 s, all 4,000 output tokens spent on hidden reasoning, no verse ($0.064) |
| DeepSeek V4.1 Flash, reasoning on | 15 s, 4,000 tokens of reasoning (11,000 characters), `finish_reason: length`, no verse |
| DeepSeek V4.1 Flash, reasoning off | **4.6 s, five rhymed quatrains, only the family's details** |

The fix was a chat-template switch (`chat_template_kwargs: {thinking: false}`), set per job. I lost twenty minutes first blaming my JSON schema; the raw response, with `completion_tokens: 4000` and an empty `content`, is what told the truth.

Each Featherless model also costs 1, 2 or 4 "concurrency units" against the plan, so the app answers and compares in parallel through a small queue that never asks for more units than the plan has.

### Voice: ElevenLabs as a narrator, never her

- **Hearing.** ElevenLabs Scribe transcribes questions and new stories. It is sent the family's names and the altar's items as keyterms, so "Tío Chucho" and "chilhuacles" come back spelled right. Whisper running locally heard "chilewacles".
- **Speaking.** A stock ElevenLabs voice (`eleven_multilingual_v2`, one voice for both languages) reads answers and the calavera aloud, and the candle flames follow its loudness.
- **The line I won't cross.** Before generating audio, the code looks up the voice's category and refuses `cloned` and `professional` voices. Ofrenda will never speak in a dead person's voice, even if someone has the recordings to make one.

### Built by open models, too

Hermes Agent, running DeepSeek V4.1 Flash, built the first two tasks from written briefs: the workspace, and the whole core (config, offline guard, schema, hybrid search, the grounded-answer guard, ingest, the eval). That's about 3,300 lines with 45 tests. On the second brief it hit its 150-step limit, then crashed on the retry. I reviewed and kept its code, and finished the web app, voice, two truths and calavera with Claude Code so I could ship before the deadline.

### The honesty eval

`seed/abuela-rosa/eval.json` has 12 questions; 4 of them have no answer in the stories (her husband's name, her favourite color, a trip to the United States, how she died).

| Model | Found correctly | Citations valid | Invented names or numbers |
|---|---|---|---|
| Gemma 4 31B (Featherless) | **12/12** | 100% | **0** |
| Gemma 3 4B (Ollama, 4 GB laptop GPU, first eight stories) | 11/12 | 100% | 0 |

The 4B's one miss: asked for her favourite color, it quoted Ana's story about a failed exam instead of saying nobody told it.

## Why Does Open Innovation Matter?

**Because the most important code in this project is the code I wrote around the model, and open weights let me own it.** The guard that throws away an invented name, the rule that two tellers must both be shown, the refusal to clone a voice: none of these are settings in someone's API. They're forty-line functions I could test against the exact model behind them, on a fixed set of weights that won't change under me next month.

**Because a family's stories shouldn't depend on one company staying in business.** The app runs on open weights served by Featherless today. Set `OFRENDA_PROVIDER=ollama` and the same code runs Gemma 3 and EmbeddingGemma on the family's own laptop with the internet off; that's how the 11/12 above was measured, on a 4 GB GPU. In the default cloud mode the stories go to Featherless to be read. A family who wants nothing to leave the house can keep it all at home, and next November the ofrenda still opens.

**Because I could pick the right model for each job, and see why the wrong ones failed.** Gemma for careful reading, DeepSeek for verse, Qwen for retrieval. When the giants wrote nothing, open models made the failure inspectable: I could read the token counts, see the reasoning budget being eaten, and turn reasoning off for one job only.

**Where closed would have been easier:** a single frontier API would have answered faster than the 2–34 seconds Gemma 4 takes here through a shared host, and I wouldn't have had to learn which chat-template flag turns DeepSeek's thinking off. For a memorial, I'll take slower and mine.

## The Spirit of It

{{REAL_MOMENT: replace this paragraph if you try it with a real family story. What did someone say when the ofrenda credited them? If not, keep the paragraph below.}}

The moment it landed for me was a test question I didn't expect to matter: *"What did she sing while washing the dishes?"* The ofrenda answered with Mateo's "Canción Mixteca," then quietly added that Ana Sofía remembers "La Llorona, siempre La Llorona, y bajito," because, Ana says, that's how you sing to the ones who are gone. Two grandchildren, the same sink, two songs. Neither of them is wrong, and nothing in the machine gets to pretend one of them is.

The last thing Rosa did, in Ana's story, was check the petal path from the door to the altar and fix the corners. *If the path is crooked, they get lost.* That's the whole design brief, really.

## Prize Categories

- **Best Use of Gemma**: Gemma 4 31B answers every question and passes the 12-question honesty eval at 12/12; Gemma 3 4B runs the same app locally.
- **Best Use of ElevenLabs**: Scribe with family keyterms for bilingual questions and stories; a stock narrator for answers and the calavera, with candles that follow the voice; cloned voices refused in code; the demo video's narration.
- **Best Use of Tiger Data**: Postgres with pgvector, pgvectorscale (DiskANN) and pg_textsearch (BM25), fused with RRF in one query, self-hosted from the open-source `timescaledb-ha` image.

*Picture credits: José Guadalupe Posada's "La Calavera Oaxaqueña" (1903) and "La Calavera Catrina", public domain; U.S. Bureau of Public Roads survey photos of Oaxaca (1950), public domain; National Photo Company, "Water peddler, Oaxaca", public domain; "Altardediademuertos" by Eneas de Troya, CC BY 2.0; "Mole negro de Oaxaca con arroz" by ProtoplasmaKid, CC BY-SA 4.0; "Miquiztlaxcalli" by Fluence, public domain; "Tagetes erecta" by Joydeep, CC BY-SA 3.0. Rosa's portrait is a generated linocut illustration of a fictional person.*
