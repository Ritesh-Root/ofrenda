import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfflineError, assertCloudAllowed, isOffline } from './offline.js';
import { transcribe } from './ingest/transcribe.js';
import { loadConfig } from './config.js';

const offlineEnv = { OFRENDA_OFFLINE: '1' };

describe('offline guard', () => {
  afterEach(() => {
    delete process.env.OFRENDA_OFFLINE;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads the flag at call time, not at import time', () => {
    expect(isOffline(offlineEnv)).toBe(true);
    expect(isOffline({ OFRENDA_OFFLINE: '0' })).toBe(false);
    expect(isOffline({})).toBe(false);
  });

  it('offline: assertCloudAllowed throws an OfflineError naming the adapter', () => {
    expect(() => assertCloudAllowed('elevenlabs-stt', offlineEnv)).toThrow(OfflineError);
    try {
      assertCloudAllowed('elevenlabs-stt', offlineEnv);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as OfflineError).name).toBe('OfflineError');
      expect((error as OfflineError).adapter).toBe('elevenlabs-stt');
      expect((error as OfflineError).message).toContain('offline');
    }
  });

  it('offline: does nothing when the flag is off', () => {
    expect(() => assertCloudAllowed('elevenlabs-stt', {})).not.toThrow();
  });

  it('offline: cloud transcription refuses to run and makes no network request', async () => {
    process.env.OFRENDA_OFFLINE = '1';
    const fetchSpy = vi.fn(() => {
      throw new Error('the offline guard let a network call through');
    });
    vi.stubGlobal('fetch', fetchSpy);

    await expect(
      transcribe(
        { audioPath: '/tmp/does-not-matter.wav', stt: 'elevenlabs' },
        { config: loadConfig({ OFRENDA_OFFLINE: '1', ELEVENLABS_API_KEY: 'not-a-real-key' }) },
      ),
    ).rejects.toBeInstanceOf(OfflineError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('offline: local transcription is unaffected, because it is not a cloud adapter', async () => {
    process.env.OFRENDA_OFFLINE = '1';
    const transcript = await transcribe(
      { audioPath: '/tmp/local.wav' },
      {
        config: loadConfig({ OFRENDA_OFFLINE: '1' }),
        transcribeLocal: async () => ({ text: 'Every Sunday my mother started the mole negro.' }),
      },
    );
    expect(transcript.provider).toBe('whisper');
    expect(transcript.lang).toBe('en');
  });
});
