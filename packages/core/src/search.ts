/**
 * Hybrid search: BM25 (pg_textsearch) + vector (EmbeddingGemma) fused with Reciprocal Rank Fusion.
 *
 * The interface is one function. Everything below it — the query prefix, the two ranked lists, the
 * RRF arithmetic, the sharing filter — is implementation, and it happens in **one SQL statement** so
 * the family's laptop does one round trip and `allowedIds` is a predicate rather than a post-filter
 * (SPEC §5: never filter after the fact, or a private memory could be scored, counted, or leaked).
 *
 * Why one statement: the CTEs keep both retrievers at `RANK_WINDOW` rows, fuse by id, and only then
 * join the rows we return. A post-filter would let a private memory consume a top-k slot and change
 * `score` for the memories the caller is allowed to see.
 *
 * BM25 operator: `body <@> to_bm25query($2, 'memories_bm25')` returns a NEGATIVE score (lower is
 * better), so the ranking orders ascending. The index name is explicit because pg_textsearch cannot
 * infer an index from dynamic query text (README "Explicit Queries"
 * https://github.com/timescale/pg_textsearch#explicit-queries).
 */

import type { Pool } from 'pg';

import { createModels } from './model.js';
import { getPool, toSqlVector } from './db/queries.js';

/** How many rows each retriever contributes before fusion. */
export const RANK_WINDOW = 20;

/** RRF constant from SPEC §5: `score = Σ 1/(60 + rank)`, ranks starting at 1. */
export const RRF_K = 60;

/** One retrieved memory, in the shape callers (answer, agent, CLI, web) actually use. */
export interface MemoryHit {
  id: string;
  title: string;
  teller: string | null;
  year: number | null;
  body: string;
  /** Fused RRF score: ~0.016 for a single first-place retriever, ~0.033 when both agree. */
  score: number;
}

export interface SearchOptions {
  /** How many hits to return. */
  k?: number;
  /** Memory ids the caller may see (from OpenFGA). `undefined` = no sharing filter. */
  allowedIds?: string[];
  /** Embed the query text. Injected in tests; defaults to EmbeddingGemma with the query prefix. */
  embedQuery?: (text: string) => Promise<number[]>;
  /** Connection pool, for tests that need an explicit database. */
  pool?: Pool;
}

interface HitRow {
  id: string;
  title: string;
  year: number | null;
  body: string;
  teller: string | null;
  score: number;
}

const SEARCH_SQL = `
with bm25_hits as (
  select id,
         row_number() over (order by body <@> to_bm25query($2::text, 'memories_bm25')) as rank
    from memories
   where person_id = $1
     and ($4::text[] is null or id = any($4::text[]))
   order by body <@> to_bm25query($2::text, 'memories_bm25')
   limit ${RANK_WINDOW}
),
vector_hits as (
  select id,
         row_number() over (order by embedding <=> $3::vector) as rank
    from memories
   where person_id = $1
     and embedding is not null
     and ($4::text[] is null or id = any($4::text[]))
   order by embedding <=> $3::vector
   limit ${RANK_WINDOW}
),
fused as (
  select id, sum(1.0 / (${RRF_K} + rank)) as score
    from (select id, rank from bm25_hits union all select id, rank from vector_hits) hit
   group by id
)
select m.id, m.title, m.year, m.body, t.name as teller, f.score
  from fused f
  join memories m on m.id = f.id
  left join tellers t on t.id = m.teller_id
 order by f.score desc, m.id
 limit $5
`;

/**
 * Rank the memories told about one person for a question, best first.
 *
 * Returns at most `k` hits (never more than `RANK_WINDOW` per list). An empty array means "the family
 * has not told the ofrenda about this" — `answer.ts` turns that into `found: false`.
 */
export async function searchMemories(
  personId: string,
  query: string,
  options: SearchOptions = {},
): Promise<MemoryHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const k = options.k ?? 6;
  const pool = options.pool ?? getPool();
  const embedQuery = options.embedQuery ?? ((text: string) => createModels().embedQuery(text));
  const vector = await embedQuery(trimmed);

  const { rows } = await pool.query<HitRow>(SEARCH_SQL, [
    personId,
    trimmed,
    toSqlVector(vector),
    options.allowedIds ?? null,
    k,
  ]);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    teller: row.teller,
    year: row.year,
    body: row.body,
    score: Number(row.score),
  }));
}
