/**
 * Apply `schema.sql` (SPEC §5). Idempotent: the file only creates objects with IF NOT EXISTS, so this
 * runs on every `ofrenda init` and every deploy without dropping a family's memories.
 *
 * `pnpm --filter @ofrenda/core db:migrate` runs this file directly; `migrate()` is also what
 * `seed.ts` and the CLI call.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { getConfig } from '../config.js';

export interface MigrateReport {
  extensions: string[];
  tables: string[];
  indexes: string[];
}

const schemaPath = new URL('./schema.sql', import.meta.url);

/** Read the schema file that ships beside this module. */
export async function readSchema(): Promise<string> {
  return readFile(fileURLToPath(schemaPath), 'utf8');
}

/** Apply the schema. Returns what exists afterwards, which is what `ofrenda doctor` reports. */
export async function migrate(databaseUrl: string = getConfig().databaseUrl): Promise<MigrateReport> {
  const sql = await readSchema();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    // One statement batch: pg runs it in a single implicit transaction, so a failure leaves nothing
    // half-applied.
    await client.query(sql);
    return await report(client);
  } finally {
    await client.end();
  }
}

async function report(client: Client): Promise<MigrateReport> {
  const extensions = await client.query<{ extname: string }>(
    `select extname from pg_extension order by extname`,
  );
  const tables = await client.query<{ relname: string }>(
    `select relname from pg_class
      where relkind = 'r' and relnamespace = 'public'::regnamespace
      order by relname`,
  );
  const indexes = await client.query<{ relname: string }>(
    `select c.relname
       from pg_index i
       join pg_class c on c.oid = i.indexrelid
       join pg_class t on t.oid = i.indrelid
       join pg_am am on am.oid = c.relam
      where t.relnamespace = 'public'::regnamespace
      order by c.relname`,
  );
  return {
    extensions: extensions.rows.map((row) => row.extname),
    tables: tables.rows.map((row) => row.relname),
    indexes: indexes.rows.map((row) => row.relname),
  };
}

/** True when this module was started as a script rather than imported. */
function isMain(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && fileURLToPath(import.meta.url) === entry;
}

if (isMain()) {
  try {
    const result = await migrate();
    console.log(`schema applied to ${new URL(getConfig().databaseUrl).pathname.slice(1)}`);
    console.log(`extensions: ${result.extensions.join(', ')}`);
    console.log(`tables:     ${result.tables.join(', ')}`);
    console.log(`indexes:    ${result.indexes.join(', ')}`);
  } catch (error) {
    console.error(`migrate failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
