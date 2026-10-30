import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getConfig } from './config.js';
import { closePool, dbReachable } from './db/queries.js';
import { migrate } from './db/migrate.js';
import { ensureSeeded } from './seed.js';
import { ollamaStatus, hasModel } from './model.js';
import { searchMemories } from './search.js';

const config = getConfig();
const db = await dbReachable();
const ollama = await ollamaStatus(config);
const ready = db.up && ollama.up && hasModel(ollama, config.embedModel);

describe('hybrid search: the small contracts', () => {
  it('returns nothing for a blank question without embedding anything', async () => {
    let embedded = false;
    const hits = await searchMemories('rosa-mendez', '   ', {
      embedQuery: async () => {
        embedded = true;
        return [];
      },
    });
    expect(hits).toEqual([]);
    expect(embedded).toBe(false);
  });
});

describe.runIf(ready)('hybrid search on the seed ofrenda', () => {
  beforeAll(async () => {
    await migrate();
    await ensureSeeded('rosa-mendez', { log: () => {} });
  }, 300_000);

  it(
    'ranks "mole domingos" with m1 (Mole on Sundays) first',
    async () => {
      const hits = await searchMemories('rosa-mendez', 'mole domingos');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]?.id).toBe('m1');
      expect(hits[0]?.teller).toBe('Guadalupe (Lupita)');
      expect(hits[0]?.score ?? 0).toBeGreaterThan(0);
    },
    120_000,
  );

  it(
    'ranks "canción" with m3 (The song she sang off-key) first',
    async () => {
      const hits = await searchMemories('rosa-mendez', 'canción');
      expect(hits[0]?.id).toBe('m3');
    },
    120_000,
  );

  it(
    'honours the k argument',
    async () => {
      const hits = await searchMemories('rosa-mendez', 'chocolate puesto mercado', { k: 2 });
      expect(hits.length).toBeLessThanOrEqual(2);
    },
    120_000,
  );

  it(
    'applies allowedIds inside SQL: a private memory cannot appear or score',
    async () => {
      const onlyM3 = await searchMemories('rosa-mendez', 'mole domingos', { allowedIds: ['m3'] });
      expect(onlyM3.every((hit) => hit.id === 'm3')).toBe(true);

      const nothing = await searchMemories('rosa-mendez', 'mole domingos', { allowedIds: [] });
      expect(nothing).toEqual([]);
    },
    120_000,
  );
});

afterAll(async () => {
  await closePool();
});
