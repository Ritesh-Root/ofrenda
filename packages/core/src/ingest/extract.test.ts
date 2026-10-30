import { readFile } from 'node:fs/promises';
import { afterAll, describe, expect, it } from 'vitest';

import { getConfig } from '../config.js';
import { closePool, dbReachable, getPool, listItems } from '../db/queries.js';
import { ollamaStatus, hasModel, type Models } from '../model.js';
import { ensureSeeded } from '../seed.js';
import { buildExtractPrompt, EXTRACT_SYSTEM } from '../prompts/extract.js';
import { extractionSchema, extractItems, matchesItemName, type Extraction } from './extract.js';

const SEED_DIR = new URL('../../../../seed/abuela-rosa/', import.meta.url);

interface SeedStory {
  id: string;
  title: string;
  lang: 'es' | 'en' | 'mixed';
  text: string;
}

interface GoldenItem {
  name: string;
  from: string[];
}

const stories = (
  JSON.parse(await readFile(new URL('stories.json', SEED_DIR), 'utf8')) as { stories: SeedStory[] }
).stories;
const golden = (
  JSON.parse(await readFile(new URL('ofrenda-items.json', SEED_DIR), 'utf8')) as {
    groups: { items: GoldenItem[] }[];
  }
).groups.flatMap((group) => group.items);

describe('item names', () => {
  it('matches a golden name to the same item with different casing or accents', () => {
    expect(matchesItemName('Mole negro', 'mole negro')).toBe(true);
    expect(matchesItemName('Canción Mixteca', 'cancion mixteca')).toBe(true);
    expect(matchesItemName('Pan de yema', 'Pan de yema de Oaxaca')).toBe(true);
  });

  it('does not match two different items', () => {
    expect(matchesItemName('Mole negro', 'Pan de muerto')).toBe(false);
    expect(matchesItemName('Cempasúchil', 'Monte Albán')).toBe(false);
  });

  it('validates the structured-output shape the model must return', () => {
    const parsed = extractionSchema.safeParse({
      items: [{ kind: 'food', name: 'Mole negro', note: 'Sundays' }],
    });
    expect(parsed.success).toBe(true);
    expect(extractionSchema.safeParse({ items: [{ kind: 'dessert', name: 'Flan' }] }).success).toBe(
      false,
    );
  });

  it('tells the model not to invent anything', () => {
    expect(EXTRACT_SYSTEM).toMatch(/never guess/i);
    expect(buildExtractPrompt({ personName: 'Rosa', title: 'Mole', body: 'Mole.', lang: 'en' })).toContain(
      'kind must be one of',
    );
  });
});

describe('extractItems wiring', () => {
  it('upserts the items and records a mention for the memory', async () => {
    const db = await dbReachable();
    if (!db.up) return;

    await ensureSeeded('rosa-mendez', { log: () => {} });
    await getPool().query(`delete from item_mentions where memory_id = 'test-extract'`);
    await getPool().query(`delete from memories where id = 'test-extract'`);
    await getPool().query(
      `insert into memories (id, person_id, title, lang, body, source)
       values ('test-extract', 'rosa-mendez', 'Wiring', 'en', 'She grew cempasúchil on the roof.', 'typed')`,
    );

    const fake: Models = {
      chat: async () => '',
      generateObject: async <T>() =>
        ({ items: [{ kind: 'ritual', name: 'Cempasúchil', note: 'on the roof' }] }) as T,
      embedQuery: async () => [],
      embedDocuments: async () => [],
    };

    const items = await extractItems(
      {
        personId: 'rosa-mendez',
        personName: 'Rosa Elena Méndez Cruz',
        memory: { id: 'test-extract', title: 'Wiring', body: 'She grew cempasúchil.', lang: 'en' },
      },
      { models: fake },
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('cempasuchil');
    const saved = (await listItems('rosa-mendez')).find((item) => item.id === 'cempasuchil');
    expect(saved?.name).toBe('Cempasúchil');

    const { rows } = await getPool().query(
      `select 1 from item_mentions where item_id = 'cempasuchil' and memory_id = 'test-extract'`,
    );
    expect(rows).toHaveLength(1);
  }, 120_000);
});

const config = getConfig();
const ollama = await ollamaStatus(config);
const db = await dbReachable();
const ready = db.up && ollama.up && hasModel(ollama, config.model);

describe.runIf(ready)('extraction recall against seed/abuela-rosa/ofrenda-items.json', () => {
  it(
    'recalls at least 70% of the golden items (SPEC §7 step 4)',
    async () => {
      const models = (await import('../model.js')).createModels(config);
      let expected = 0;
      let matched = 0;
      const misses: string[] = [];

      for (const story of stories) {
        const extraction = await models.generateObject<Extraction>({
          schema: extractionSchema,
          system: EXTRACT_SYSTEM,
          schemaName: 'ofrenda_items',
          prompt: buildExtractPrompt({
            personName: 'Rosa Elena Méndez Cruz',
            title: story.title,
            body: story.text,
            lang: story.lang,
          }),
        });

        const wanted = golden.filter((item) => item.from.includes(story.id));
        for (const item of wanted) {
          expected += 1;
          const found = extraction.items.some((candidate) =>
            matchesItemName(candidate.name, item.name),
          );
          if (found) matched += 1;
          else misses.push(`${story.id}:${item.name}`);
        }
      }

      const recall = matched / expected;
      console.log(
        `extraction recall ${matched}/${expected} = ${(recall * 100).toFixed(1)}%` +
          (misses.length > 0 ? ` (missed ${misses.join(', ')})` : ''),
      );
      expect(recall).toBeGreaterThanOrEqual(0.7);
    },
    900_000,
  );
});

afterAll(async () => {
  if (db.up) {
    await getPool().query(`delete from item_mentions where memory_id in ('test-extract')`);
    await getPool().query(`delete from memories where id in ('test-extract', 'test-idempotent')`);
  }
  await closePool();
});
