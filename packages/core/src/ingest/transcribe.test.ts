import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../config.js';
import { detectLanguage, transcribe } from './transcribe.js';

describe('language detection for a transcript', () => {
  it('recognises Spanish', () => {
    expect(detectLanguage('Ella molía el chocolate con canela delante de los clientes, y la gente compraba lo que veía hacer.')).toBe('es');
  });

  it('recognises English', () => {
    expect(
      detectLanguage('Every Sunday my mother started the mole before the church bells rang, and she was not in a hurry.'),
    ).toBe('en');
  });

  it('calls a sentence that mixes both "mixed"', () => {
    expect(
      detectLanguage(
        'Every Sunday ella empezaba el mole con la abuela, and she would laugh at the neighbours.',
      ),
    ).toBe('mixed');
  });

  it('ignores accents and case', () => {
    expect(detectLanguage('¿POR QUÉ NUNCA CORRÍA? PORQUE HAY MÁS TIEMPO QUE VIDA')).toBe('es');
  });
});

describe('transcribe', () => {
  it('uses the injected local transcriber and keeps its language guess', async () => {
    const result = await transcribe(
      { audioPath: '/tmp/anything.wav' },
      {
        config: loadConfig({}),
        transcribeLocal: async () => ({ text: 'Every Sunday she started the mole negro.' }),
      },
    );
    expect(result).toEqual({
      text: 'Every Sunday she started the mole negro.',
      lang: 'en',
      provider: 'whisper',
    });
  });

  it('refuses the cloud path without a key, before any network call', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(
      transcribe(
        { audioPath: '/tmp/anything.wav', stt: 'elevenlabs' },
        { config: loadConfig({ OFRENDA_OFFLINE: '0', ELEVENLABS_API_KEY: '' }) },
      ),
    ).rejects.toThrow(/ELEVENLABS_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
