import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isWhisperBuilt, transcribeAudio } from './whisper.js';

const built = await isWhisperBuilt();

/**
 * The audio in the seed is the fixture: `m1-lupita-mole-en.wav` is Lupita telling the mole story in
 * English. The test skips when the native whisper addon is not built (fresh clone, CI without a
 * compiler), which is what SPEC's "runIf whisper is built" asks for.
 */
const audio = fileURLToPath(
  new URL('../../../../seed/audio/m1-lupita-mole-en.wav', import.meta.url),
);

describe.runIf(built)('local whisper', () => {
  it(
    'transcribes the seed audio of Lupita telling the mole story',
    async () => {
      const result = await transcribeAudio(audio, { model: 'base' });
      expect(result.model).toBe('base');
      expect(result.text.length).toBeGreaterThan(20);
      expect(result.text.toLowerCase()).toContain('mole');
    },
    900_000,
  );
});

describe.runIf(!built)('local whisper is not built', () => {
  it('reports that the addon is missing instead of pretending to transcribe', async () => {
    expect(built).toBe(false);
    await expect(transcribeAudio(audio)).rejects.toThrow();
  });
});
