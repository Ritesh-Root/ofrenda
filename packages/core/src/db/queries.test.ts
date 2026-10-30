import { afterAll, describe, expect, it } from 'vitest';

import { ensureSeeded } from '../seed.js';
import {
  closePool,
  dbReachable,
  getPerson,
  getPool,
  listMemories,
  listTellers,
  setMemoryEmbedding,
  slugify,
  toSqlVector,
  upsertMemory,
} from './queries.js';

const status = await dbReachable();

describe('query helpers', () => {
  it('slugifies an item name so accents and case do not fork a row', () => {
    expect(slugify('Canción Mixteca')).toBe('cancion-mixteca');
    expect(slugify('  Al mal tiempo, buena cara  ')).toBe('al-mal-tiempo-buena-cara');
    expect(slugify('***')).toBe('');
  });

  it("writes a vector in pgvector's text form", () => {
    expect(toSqlVector([0.5, -1, 2])).toBe('[0.5,-1,2]');
  });
});

describe.runIf(status.up)('queries against the seed database', () => {
  it(
    'seeds the fictional ofrenda once, no matter how often it is called',
    async () => {
      const first = await ensureSeeded('rosa-mendez', { log: () => {} });
      const second = await ensureSeeded('rosa-mendez', { log: () => {} });
      expect(second).toBeNull();
      const memories = await listMemories('rosa-mendez');
      expect(memories.length).toBeGreaterThanOrEqual(8);
      expect(first === null ? 'already seeded' : 'seeded now').toBeTruthy();
    },
    240_000,
  );

  it(
    'upserts a memory twice without duplicating it',
    async () => {
      const input = {
        id: 'test-idempotent',
        personId: 'rosa-mendez',
        title: 'Idempotency',
        lang: 'en' as const,
        body: 'Writing the same memory twice must leave one row.',
        source: 'typed' as const,
      };
      await upsertMemory(input);
      await upsertMemory({ ...input, title: 'Idempotency (updated)' });
      const matching = (await listMemories('rosa-mendez')).filter(
        (memory) => memory.id === 'test-idempotent',
      );
      expect(matching).toHaveLength(1);
      expect(matching[0]?.title).toBe('Idempotency (updated)');
    },
    120_000,
  );

  it(
    'stores a 768-d vector',
    async () => {
      const [memory] = await listMemories('rosa-mendez');
      expect(memory).toBeDefined();
      const vector = Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0));
      await setMemoryEmbedding('test-idempotent', vector);
      const { rows } = await getPool().query<{ dims: number }>(
        `select vector_dims(embedding) as dims from memories where id = $1`,
        ['test-idempotent'],
      );
      expect(rows[0]?.dims).toBe(768);
      void memory;
    },
    120_000,
  );

  it('reads the seeded person and her four tellers', async () => {
    const person = await getPerson('rosa-mendez');
    expect(person?.name).toBe('Rosa Elena Méndez Cruz');
    const tellers = await listTellers('rosa-mendez');
    expect(tellers.map((teller) => teller.id).sort()).toEqual(['ana', 'chucho', 'lupita', 'mateo']);
  });
});

afterAll(async () => {
  if (status.up) {
    await getPool().query(`delete from item_mentions where memory_id in ('test-extract')`);
    await getPool().query(`delete from memories where id in ('test-extract', 'test-idempotent')`);
  }
  await closePool();
});
