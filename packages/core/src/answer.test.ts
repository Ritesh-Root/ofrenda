import { afterAll, describe, expect, it, vi } from 'vitest';

import { getConfig } from './config.js';
import { closePool, dbReachable, listMemories } from './db/queries.js';
import { ollamaStatus, hasModel } from './model.js';
import { ensureSeeded } from './seed.js';
import {
  answerQuestion,
  bestSentences,
  contentWords,
  inventedTerms,
  judge,
  type ModelAnswer,
} from './answer.js';
import type { MemoryHit } from './search.js';

const MOLE_BODY =
  'Every Sunday my mother started the mole negro before the church bells at Santo Domingo rang for seven o\'clock mass. ' +
  'She toasted the chilhuacles until the whole street coughed, and she would laugh and say the neighbours should thank her. ' +
  "When I was fourteen she finally handed me the wooden spoon and said, 'Now you will never be hungry.'";

const hit = (overrides: Partial<MemoryHit> = {}): MemoryHit => ({
  id: 'm1',
  title: 'Mole on Sundays',
  teller: 'Guadalupe (Lupita)',
  year: 1974,
  body: MOLE_BODY,
  score: 0.032,
  ...overrides,
});

describe('extractive fallback (ported from design/mockups/ask.js bestSentences)', () => {
  it('picks the sentence that shares the most content words with the question', () => {
    const answer = bestSentences(MOLE_BODY, 'what did she cook on Sundays?');
    expect(answer).toContain('mole negro');
  });

  it('returns the sentences in reading order, not score order', () => {
    const body = 'The mole started early. Nobody stirred it but her. Sundays were for mole.';
    const answer = bestSentences(body, 'mole Sundays');
    expect(answer.indexOf('Sundays were for mole')).toBeGreaterThan(
      answer.indexOf('The mole started early'),
    );
  });

  it('drops stopwords but keeps the words that carry meaning', () => {
    expect(contentWords('What did she cook on the Sundays?')).toEqual(['cook', 'sundays']);
  });
});

describe('the guard: invented names and numbers', () => {
  it('flags a capitalised name the family never wrote', () => {
    expect(inventedTerms('Her husband Rogelio cooked the mole.', [MOLE_BODY])).toEqual(['Rogelio']);
  });

  it('accepts a sentence-initial ordinary word that appears in the story', () => {
    expect(inventedTerms('Every Sunday she started the mole negro.', [MOLE_BODY])).toEqual([]);
  });

  it('flags a number that is not in the cited story', () => {
    expect(inventedTerms('She cooked it for 43 years.', [MOLE_BODY])).toEqual(['43']);
  });

  it('accepts a number the family actually said', () => {
    expect(inventedTerms('She handed over the spoon when I was fourteen.', [MOLE_BODY])).toEqual([]);
  });
});

describe('judge: which of the three paths an answer takes', () => {
  it('returns none when the model says the family never told it', () => {
    const answer = judge({ found: false, answer: 'Nobody knows.', citations: [] }, [hit()], 'husband?');
    expect(answer).toMatchObject({ found: false, mode: 'none', citations: [] });
  });

  it('drops citations that are not in the retrieved hits and falls back to extractive', () => {
    const model: ModelAnswer = {
      found: true,
      answer: 'She cooked mole negro every Sunday.',
      citations: ['m9'],
    };
    const answer = judge(model, [hit()], 'what did she cook?');
    expect(answer.mode).toBe('extractive');
    expect(answer.citations.map((citation) => citation.id)).toEqual(['m1']);
  });

  it('rejects an answer that invents a name, even with a valid citation', () => {
    const model: ModelAnswer = {
      found: true,
      answer: 'Her husband Rogelio loved the mole negro.',
      citations: ['m1'],
    };
    expect(judge(model, [hit()], 'who loved the mole?').mode).toBe('extractive');
  });

  it('keeps the model answer when every citation is real and nothing is invented', () => {
    const model: ModelAnswer = {
      found: true,
      answer: 'She started the mole negro before the church bells at Santo Domingo.',
      citations: ['m1'],
    };
    const answer = judge(model, [hit()], 'what did she cook on Sundays?');
    expect(answer.mode).toBe('model');
    expect(answer.found).toBe(true);
    expect(answer.citations).toEqual([
      { id: 'm1', title: 'Mole on Sundays', teller: 'Guadalupe (Lupita)' },
    ]);
  });
});

describe('answerQuestion: the retrieval floor decides before the model runs', () => {
  it('does not call the model when the best RRF score is under the threshold', async () => {
    const generateObject = vi.fn();
    const answer = await answerQuestion(
      { personId: 'rosa-mendez', question: 'What was her husband called?' },
      {
        search: async () => [hit({ score: 0.01 })],
        models: { generateObject, chat: vi.fn(), embedQuery: vi.fn(), embedDocuments: vi.fn() } as never,
      },
    );
    expect(answer).toMatchObject({ found: false, mode: 'none' });
    expect(generateObject).not.toHaveBeenCalled();
  });

  it('returns none when retrieval finds nothing at all', async () => {
    const answer = await answerQuestion(
      { personId: 'rosa-mendez', question: 'anything' },
      { search: async () => [] },
    );
    expect(answer).toMatchObject({ found: false, mode: 'none' });
  });
});

const config = getConfig();
const db = await dbReachable();
const ollama = await ollamaStatus(config);
const ready = db.up && ollama.up && hasModel(ollama, config.model);

describe.runIf(ready)('answerQuestion on the seed ofrenda', () => {
  it(
    'answers a tellable question from a real memory and cites it',
    async () => {
      await ensureSeeded('rosa-mendez', { log: () => {} });
      const memories = await listMemories('rosa-mendez');
      const known = new Set(memories.map((memory) => memory.id));

      const answer = await answerQuestion({
        personId: 'rosa-mendez',
        personName: 'Rosa Elena Méndez Cruz',
        question: 'What did she cook on Sundays?',
      });

      expect(answer.found).toBe(true);
      expect(['model', 'extractive']).toContain(answer.mode);
      expect(answer.citations.length).toBeGreaterThan(0);
      expect(answer.citations.every((citation) => known.has(citation.id))).toBe(true);
      expect(answer.citations.map((citation) => citation.id)).toContain('m1');
    },
    300_000,
  );

  it(
    'says nobody told it when the family never mentioned the thing asked about',
    async () => {
      const answer = await answerQuestion({
        personId: 'rosa-mendez',
        personName: 'Rosa Elena Méndez Cruz',
        question: '¿Cuál era su color favorito?',
      });
      expect(answer.found).toBe(false);
      expect(answer.mode).toBe('none');
    },
    300_000,
  );
});

afterAll(async () => {
  await closePool();
});
