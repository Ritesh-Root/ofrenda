/**
 * Every SQL statement Ofrenda runs lives here. The rest of the package calls these functions; no
 * module outside `db/` writes SQL (the one exception is `search.ts`, whose hybrid query is a single
 * statement by design and is documented there).
 *
 * Shapes are plain objects, not pg rows: callers never see `person_id` vs `personId` confusion, and
 * adding a column does not ripple out of this file.
 */

import { Pool } from 'pg';

import { getConfig } from '../config.js';

export interface MemoryRow {
  id: string;
  personId: string;
  tellerId: string | null;
  title: string;
  lang: 'es' | 'en' | 'mixed';
  year: number | null;
  body: string;
  source: 'seed' | 'typed' | 'audio' | 'archive';
  audioPath: string | null;
}

export interface NewMemory {
  id: string;
  personId: string;
  tellerId?: string | null;
  title: string;
  lang: 'es' | 'en' | 'mixed';
  year?: number | null;
  body: string;
  source: MemoryRow['source'];
  audioPath?: string | null;
}

export interface PersonRow {
  id: string;
  name: string;
  shortName: string;
  bornYear?: number | null;
  diedYear?: number | null;
  bornPlace?: string | null;
  data?: Record<string, unknown>;
}

export interface TellerRow {
  id: string;
  personId: string;
  name: string;
  relation: string;
  hue: number;
}

export interface OfrendaItem {
  id: string;
  personId: string;
  kind: 'food' | 'song' | 'place' | 'saying' | 'ritual' | 'photo' | 'date';
  name: string;
  note: string | null;
}

export interface NewOfrendaItem {
  personId: string;
  kind: OfrendaItem['kind'];
  name: string;
  note?: string | null;
  /** Defaults to a slug of `name`, which is also what makes upserts idempotent. */
  id?: string;
}

let sharedPool: Pool | undefined;

/** The process-wide pool. One pool per process is the whole connection strategy. */
export function getPool(connectionString: string = getConfig().databaseUrl): Pool {
  sharedPool ??= new Pool({ connectionString, max: 4 });
  return sharedPool;
}

/** Close the pool. Tests call this so a run can exit; the CLI and web do not need to. */
export async function closePool(): Promise<void> {
  const pool = sharedPool;
  sharedPool = undefined;
  if (pool) await pool.end();
}

export interface DbStatus {
  up: boolean;
  error?: string;
}

/**
 * Can we reach Postgres? Used by `ofrenda doctor` and by tests to skip integration cases instead of
 * failing them. Never throws.
 */
export async function dbReachable(connectionString?: string): Promise<DbStatus> {
  try {
    await getPool(connectionString).query('select 1');
    return { up: true };
  } catch (error) {
    return { up: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** pgvector's text form: `[0.1,0.2,...]`, cast in SQL with `$n::vector`. */
export function toSqlVector(vector: readonly number[]): string {
  return `[${vector.join(',')}]`;
}

/** Accent-insensitive slug, so "Canción Mixteca" and "cancion mixteca" are the same item. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface DbMemoryRow {
  id: string;
  person_id: string;
  teller_id: string | null;
  title: string;
  lang: MemoryRow['lang'];
  year: number | null;
  body: string;
  source: MemoryRow['source'];
  audio_path: string | null;
}

const toMemory = (row: DbMemoryRow): MemoryRow => ({
  id: row.id,
  personId: row.person_id,
  tellerId: row.teller_id,
  title: row.title,
  lang: row.lang,
  year: row.year,
  body: row.body,
  source: row.source,
  audioPath: row.audio_path,
});

export async function upsertPerson(person: PersonRow, connectionString?: string): Promise<void> {
  await getPool(connectionString).query(
    `insert into people (id, name, short_name, born_year, died_year, born_place, data)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (id) do update set
       name = excluded.name, short_name = excluded.short_name, born_year = excluded.born_year,
       died_year = excluded.died_year, born_place = excluded.born_place, data = excluded.data`,
    [
      person.id,
      person.name,
      person.shortName,
      person.bornYear ?? null,
      person.diedYear ?? null,
      person.bornPlace ?? null,
      JSON.stringify(person.data ?? {}),
    ],
  );
}

export async function getPerson(
  personId: string,
  connectionString?: string,
): Promise<PersonRow | undefined> {
  const { rows } = await getPool(connectionString).query<{
    id: string;
    name: string;
    short_name: string;
    born_year: number | null;
    died_year: number | null;
    born_place: string | null;
    data: Record<string, unknown>;
  }>(`select * from people where id = $1`, [personId]);
  const row = rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    bornYear: row.born_year,
    diedYear: row.died_year,
    bornPlace: row.born_place,
    data: row.data,
  };
}

export async function upsertTeller(teller: TellerRow, connectionString?: string): Promise<void> {
  await getPool(connectionString).query(
    `insert into tellers (id, person_id, name, relation, hue)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update set
       person_id = excluded.person_id, name = excluded.name,
       relation = excluded.relation, hue = excluded.hue`,
    [teller.id, teller.personId, teller.name, teller.relation, teller.hue],
  );
}

export async function upsertMemory(memory: NewMemory, connectionString?: string): Promise<MemoryRow> {
  const { rows } = await getPool(connectionString).query<DbMemoryRow>(
    `insert into memories (id, person_id, teller_id, title, lang, year, body, source, audio_path)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (id) do update set
       person_id = excluded.person_id, teller_id = excluded.teller_id, title = excluded.title,
       lang = excluded.lang, year = excluded.year, body = excluded.body, source = excluded.source,
       audio_path = excluded.audio_path
     returning *`,
    [
      memory.id,
      memory.personId,
      memory.tellerId ?? null,
      memory.title,
      memory.lang,
      memory.year ?? null,
      memory.body,
      memory.source,
      memory.audioPath ?? null,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error(`upsertMemory(${memory.id}) returned no row`);
  return toMemory(row);
}

export async function setMemoryEmbedding(
  memoryId: string,
  vector: readonly number[],
  connectionString?: string,
): Promise<void> {
  await getPool(connectionString).query(`update memories set embedding = $2::vector where id = $1`, [
    memoryId,
    toSqlVector(vector),
  ]);
}

export async function getMemory(
  memoryId: string,
  connectionString?: string,
): Promise<MemoryRow | undefined> {
  const { rows } = await getPool(connectionString).query<DbMemoryRow>(
    `select * from memories where id = $1`,
    [memoryId],
  );
  const row = rows[0];
  return row ? toMemory(row) : undefined;
}

export async function listMemories(
  personId: string,
  connectionString?: string,
): Promise<MemoryRow[]> {
  const { rows } = await getPool(connectionString).query<DbMemoryRow>(
    `select * from memories where person_id = $1 order by created_at, id`,
    [personId],
  );
  return rows.map(toMemory);
}

export async function upsertItem(item: NewOfrendaItem, connectionString?: string): Promise<string> {
  const id = item.id ?? slugify(item.name);
  if (!id) throw new Error(`Cannot derive an item id from the name ${JSON.stringify(item.name)}`);
  await getPool(connectionString).query(
    `insert into ofrenda_items (id, person_id, kind, name, note)
     values ($1, $2, $3, $4, $5)
     on conflict (id) do update set
       person_id = excluded.person_id, kind = excluded.kind,
       name = excluded.name, note = coalesce(excluded.note, ofrenda_items.note)`,
    [id, item.personId, item.kind, item.name, item.note ?? null],
  );
  return id;
}

/** Idempotent: mentioning the same item from the same memory twice is a no-op. */
export async function addItemMention(
  itemId: string,
  memoryId: string,
  connectionString?: string,
): Promise<void> {
  await getPool(connectionString).query(
    `insert into item_mentions (item_id, memory_id) values ($1, $2)
     on conflict (item_id, memory_id) do nothing`,
    [itemId, memoryId],
  );
}

export async function listItems(
  personId: string,
  connectionString?: string,
): Promise<OfrendaItem[]> {
  const { rows } = await getPool(connectionString).query<{
    id: string;
    person_id: string;
    kind: OfrendaItem['kind'];
    name: string;
    note: string | null;
  }>(`select id, person_id, kind, name, note from ofrenda_items where person_id = $1 order by kind, id`, [
    personId,
  ]);
  return rows.map((row) => ({
    id: row.id,
    personId: row.person_id,
    kind: row.kind,
    name: row.name,
    note: row.note,
  }));
}

export async function saveRemembrance(input: {
  personId: string;
  body: string;
  model: string;
  memoryIds: string[];
  connectionString?: string;
}): Promise<number> {
  const { rows } = await getPool(input.connectionString).query<{ id: string }>(
    `insert into remembrances (person_id, body, model, memory_ids)
     values ($1, $2, $3, $4) returning id`,
    [input.personId, input.body, input.model, input.memoryIds],
  );
  const row = rows[0];
  if (!row) throw new Error('saveRemembrance returned no row');
  return Number(row.id);
}

export async function listTellers(
  personId: string,
  connectionString?: string,
): Promise<TellerRow[]> {
  const { rows } = await getPool(connectionString).query<{
    id: string;
    person_id: string;
    name: string;
    relation: string;
    hue: number;
  }>(`select id, person_id, name, relation, hue from tellers where person_id = $1 order by id`, [
    personId,
  ]);
  return rows.map((row) => ({
    id: row.id,
    personId: row.person_id,
    name: row.name,
    relation: row.relation,
    hue: row.hue,
  }));
}
