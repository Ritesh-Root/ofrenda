# Partner tracks: what each one does in Ofrenda

Rule: every track does a real job. If a track only appears in the README, drop it from the post.
"Show it" says what evidence goes in the DEV post (screenshots go to `post/shots/`).

| Track | Prize | Job in Ofrenda | Task | Show it |
|---|---|---|---|---|
| **Gemma** | $200 | All generation and embeddings, locally: `gemma3:4b` (or `1b`) answers, extracts items, drafts remembrances; `embeddinggemma` embeds memories. | T2, T4 | `ollama ps` while answering offline; airplane-mode screen recording |
| **Mastra** | $100 | The ofrenda agent: tools `searchMemories`, `listOfrendaItems`, `eraContext`; Postgres memory for chat threads. | T4 | agent code excerpt + a run trace |
| **Tiger Data** | $100 | Postgres with pgvector + pgvectorscale (DiskANN) + pg_textsearch BM25, fused with RRF in one SQL query. Local container; same schema on a Tiger Cloud trial service through Tiger MCP. | T2, V2 | the hybrid SQL; Tiger console screenshot of the service |
| **ElevenLabs** | $100 | Scribe v2 for bilingual family recordings (keyterms = family names); stock-voice narration of remembrances; seed audio and demo narration. Opt-in, never required. | T5, T14 | a Spanish/English recording transcribed with names right |
| **Entire** | $100 | Agent sessions behind the build, linked to commits as checkpoints. | user (install), T15 | link to checkpoints; "why does this code exist" example |
| **Temporal** | $100 | Durable ingest: slow local-GPU steps retry and resume after a crash; progress query feeds the UI. | T6 | kill the worker mid-ingest → resumes; Temporal UI screenshot |
| **Sentry Agent Tracing** | $100 | Traces for agent, tools, model calls with prompt/output capture **off**; answer mode (model / extractive / none) as an attribute; $0 local cost vs ElevenLabs cost. | T7 | trace waterfall screenshot; latency per step on a 4 GB GPU |
| **Auth0 for AI Agents** | $100 | Family login on the web app; retrieval filtered per relative with fine-grained authorization (self-hosted OpenFGA, Auth0's FGA engine) so a private memory never reaches another relative's answer. | T10 | two users, same question, different answers |
| **SerpApi** | $100 | `eraContext(place, decade)`: what Oaxaca was like in the 1950s, with sources; only place + decade leave the machine. | T11 | answer card with era facts and links |
| **GitHub Copilot** | $100 | GitHub Actions CI (typecheck, tests); Copilot review on the user's PR after they push. | T12 + user | CI run + a Copilot review comment |
| **Render** | $200 | Read-only public demo of Rosa's ofrenda. | T12 + user | live URL |
| **.tech domain** | $100 | The demo lives on the claimed .tech domain. | user | the URL |
| **Browserbase** | $100 | "Rescue a lost page": Stagehand drives web.archive.org to pull a loved one's old blog or GeoCities page into memories (a forgotten corner of the internet brought back). | T13 | before/after: archived page → memories |
| **DigitalOcean** | $200 | GPU Droplet with 1-Click Gemma as the demo's model endpoint (OpenAI-compatible). Costs money. | T16 (blocked) | droplet + endpoint latency |
| **Tinker** | $200 | LoRA on Qwen3.5-4B to write *calaveritas literarias* (Día de Muertos rhyming verses); eval baseline vs tuned (rhyme rate, rubric). Costs credits. | T17 (blocked) | eval table |
| TabPFN, Backboard, Ultramarine, MongoDB, Arduino | — | Skipped: contrived, duplicate of Tiger, cloud-only memory, or no hardware. | — | — |

## Why open matters (for the post, one line each)
- It works with the lights and the internet off: the ofrenda is on the laptop on the altar table.
- A grandmother's stories don't go to a server the family doesn't control.
- Nothing to subscribe to: when a service shuts down, the ofrenda is still there next November.
- We can read and change how it answers: the "never invent" guard is ours, not a vendor's setting.
- Swappable models: `gemma3:1b` on an old laptop, `gemma3:4b` on a better one, Gemma 4 on a GPU.
- It was built by an open-weight model too: Hermes Agent on DeepSeek-V4.1-Flash wrote the code.
