import { describe, expect, it } from 'vitest';

import { checkTruths } from './truths.js';
import type { MemoryHit } from './search.js';

const hits: MemoryHit[] = [
  { id: 'm2', title: 'El puesto de chocolate', teller: 'Jesús (Tío Chucho)', year: 1961, score: 0.03, body: 'Rosa abrió su puesto en el Mercado 20 de Noviembre con un metate prestado y tres kilos de cacao en 1961.' },
  { id: 'm9', title: 'She opened the stall in 1959', teller: 'Guadalupe (Lupita)', year: 1959, score: 0.03, body: 'My mother always said she opened her chocolate stall in 1959, the year they rebuilt the roof of the market.' },
  { id: 'm1', title: 'Mole on Sundays', teller: 'Guadalupe (Lupita)', year: 1974, score: 0.01, body: 'Every Sunday my mother started the mole negro.' },
];

describe('checkTruths', () => {
  it('keeps a grounded disagreement between two different tellers', () => {
    const t = checkTruths({ conflict: true, about: 'the year the stall opened', versions: [
      { memoryId: 'm2', says: 'abrió su puesto en el Mercado con un metate prestado' },
      { memoryId: 'm9', says: 'she opened her chocolate stall in 1959' },
    ] }, hits);
    expect(t.conflict).toBe(true);
    expect(t.versions.map((v) => v.memoryId)).toEqual(['m2', 'm9']);
  });

  it('drops versions from memories that were not retrieved, or words that are not in the memory', () => {
    const t = checkTruths({ conflict: true, about: 'x', versions: [
      { memoryId: 'm99', says: 'she opened it in 1955' },
      { memoryId: 'm9', says: 'she sold tamales in Puebla during the war' },
    ] }, hits);
    expect(t.conflict).toBe(false);
  });

  it('never treats one teller as disagreeing with themself', () => {
    const t = checkTruths({ conflict: true, about: 'x', versions: [
      { memoryId: 'm9', says: 'she opened her chocolate stall in 1959' },
      { memoryId: 'm1', says: 'my mother started the mole negro' },
    ] }, hits);
    expect(t.conflict).toBe(false);
  });
});

import { stripSpeaker } from './truths.js';
describe('stripSpeaker', () => {
  it('removes "Name:" and "Name says" labels and surrounding quotes', () => {
    expect(stripSpeaker('Mateo: Abuela sang the song', 'Mateo')).toBe('Abuela sang the song');
    expect(stripSpeaker('Ana Sofía says “Yo la oí cantar La Llorona”', 'Ana Sofía')).toBe('Yo la oí cantar La Llorona');
    expect(stripSpeaker('Lupita: she opened it in 1959', 'Guadalupe (Lupita)')).toBe('she opened it in 1959');
  });
});
