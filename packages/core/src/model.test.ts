import { describe, expect, it } from 'vitest';

import { getConfig } from './config.js';
import { createModels, documentPrefix, hasModel, ollamaStatus, queryPrompt } from './model.js';

const config = getConfig();
const status = await ollamaStatus(config);
const hasModels = hasModel(status, config.embedModel);

describe('EmbeddingGemma prompts', () => {
  it('prefixes a query the way the model card prescribes', () => {
    expect(queryPrompt('  what did she cook  ')).toBe('task: search result | query: what did she cook');
  });

  it('prefixes a document with its title, or "none" when there is no title', () => {
    expect(documentPrefix('Mole on Sundays', 'Every Sunday she started the mole negro.')).toBe(
      'title: Mole on Sundays | text: Every Sunday she started the mole negro.',
    );
    expect(documentPrefix(undefined, 'No title here')).toBe('title: none | text: No title here');
    expect(documentPrefix('   ', 'Blank title')).toBe('title: none | text: Blank title');
  });
});

describe.runIf(hasModels)('EmbeddingGemma via Ollama', () => {
  const models = createModels(config);

  it(
    'returns one 768-dimensional vector per document, in order',
    async () => {
      const vectors = await models.embedDocuments([
        { title: 'Mole on Sundays', text: 'She started the mole negro before the bells.' },
        { title: 'The song she sang off-key', text: 'Abuela sang Canción Mixteca while washing dishes.' },
      ]);
      expect(vectors).toHaveLength(2);
      expect(vectors[0]).toHaveLength(768);
      expect(vectors[1]?.every((value) => Number.isFinite(value))).toBe(true);
    },
    120_000,
  );

  it(
    'embeds a query with the query prefix',
    async () => {
      const vector = await models.embedQuery('what did she cook on Sundays?');
      expect(vector).toHaveLength(768);
    },
    120_000,
  );
});
