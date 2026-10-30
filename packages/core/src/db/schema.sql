-- Ofrenda data model (SPEC §5). Applied by `pnpm --filter @ofrenda/core db:migrate`.
--
-- Idempotent: every object is created with IF NOT EXISTS, so migrate can run on every start.
--
-- Index syntax verified against the pg_textsearch source repository (the docs site's
-- `using-pg_textsearch` page 404s), `README.md` "Indexing" and "Querying":
--   CREATE INDEX ... USING bm25(content) WITH (text_config='english');
--   SELECT ... ORDER BY content <@> 'query' LIMIT n;   -- <@> returns NEGATIVE BM25 scores
-- https://github.com/timescale/pg_textsearch/blob/main/README.md#indexing
-- The README also says an explicit index name is required when the planner cannot infer the index
-- (dynamic/prepared query text, expressions, partial indexes): `to_bm25query($1, 'memories_bm25')`,
-- which is what src/search.ts uses.
--
-- `text_config = 'simple'` on purpose: the corpus is bilingual (Spanish and English), and the
-- English stemmer mangles Spanish words. 'simple' lowercases and splits, nothing more.

create extension if not exists vector;
create extension if not exists vectorscale cascade;
create extension if not exists pg_textsearch;

create table if not exists people (
  id text primary key,
  name text not null,
  short_name text not null,
  born_year int,
  died_year int,
  born_place text,
  data jsonb not null default '{}'
);

create table if not exists tellers (
  id text primary key,
  person_id text not null references people(id) on delete cascade,
  name text not null,
  relation text not null,
  hue int not null
);

create table if not exists memories (
  id text primary key,
  person_id text not null references people(id) on delete cascade,
  teller_id text references tellers(id),
  title text not null,
  lang text not null check (lang in ('es', 'en', 'mixed')),
  year int,
  body text not null,
  source text not null check (source in ('seed', 'typed', 'audio', 'archive')),
  audio_path text,
  created_at timestamptz not null default now(),
  embedding vector(768)
);

-- bilingual corpus: 'simple' config avoids English-only stemming on Spanish text
create index if not exists memories_bm25 on memories using bm25 (body) with (text_config = 'simple');
create index if not exists memories_vec on memories using diskann (embedding vector_cosine_ops);

create table if not exists ofrenda_items (
  id text primary key,
  person_id text not null references people(id) on delete cascade,
  kind text not null check (kind in ('food', 'song', 'place', 'saying', 'ritual', 'photo', 'date')),
  name text not null,
  note text
);

create table if not exists item_mentions (
  item_id text references ofrenda_items(id) on delete cascade,
  memory_id text references memories(id) on delete cascade,
  primary key (item_id, memory_id)
);

create table if not exists remembrances (
  id bigserial primary key,
  person_id text not null references people(id) on delete cascade,
  body text not null,
  model text not null,
  memory_ids text[] not null,
  created_at timestamptz not null default now()
);

-- SerpApi results, cached; only place + decade were ever sent (SPEC §7 step 6)
create table if not exists era_context (
  place text not null,
  decade int not null,
  facts jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (place, decade)
);
