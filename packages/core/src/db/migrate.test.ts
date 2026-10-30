import { describe, expect, it } from 'vitest';

import { dbReachable, closePool } from './queries.js';
import { migrate } from './migrate.js';

const status = await dbReachable();

describe.runIf(status.up)('schema', () => {
  it(
    'applies the extensions, tables and indexes SPEC §5 names',
    async () => {
      const report = await migrate();
      expect(report.extensions).toEqual(
        expect.arrayContaining(['vector', 'vectorscale', 'pg_textsearch']),
      );
      expect(report.tables).toEqual(
        expect.arrayContaining([
          'people',
          'tellers',
          'memories',
          'ofrenda_items',
          'item_mentions',
          'remembrances',
          'era_context',
        ]),
      );
      expect(report.indexes).toEqual(expect.arrayContaining(['memories_bm25', 'memories_vec']));
    },
    120_000,
  );

  it(
    'is idempotent: a second run changes nothing and does not throw',
    async () => {
      const first = await migrate();
      const second = await migrate();
      expect(second).toEqual(first);
    },
    120_000,
  );

  it('builds a BM25 index the pg_textsearch README syntax recognises', async () => {
    const { getPool } = await import('./queries.js');
    const { rows } = await getPool().query<{ amname: string; text_config: string | null }>(
      `select am.amname, null::text as text_config
         from pg_class c
         join pg_am am on am.oid = c.relam
        where c.relname = 'memories_bm25'`,
    );
    expect(rows[0]?.amname).toBe('bm25');
  });
});

describe.runIf(!status.up)('schema without a database', () => {
  it('reports why the integration cases are skipped', () => {
    expect(status.error).toBeTruthy();
  });
});

process.on('beforeExit', async () => {
  await closePool();
});
