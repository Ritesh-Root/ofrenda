import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../config.js';
import { OfflineError } from '../offline.js';
import { ClonedVoiceError, estimateTtsCostUsd, speak } from './elevenlabs-tts.js';

const config = loadConfig({ ELEVENLABS_API_KEY: 'test-key', ELEVENLABS_VOICE_ID: 'stock-voice' });

function fakeFetch(category: string) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes('/voices/')) return new Response(JSON.stringify({ category }), { status: 200 });
    return new Response(new Uint8Array([0xff, 0xfb, 0x90]), { status: 200 });
  }) as unknown as typeof fetch;
}

describe('elevenlabs tts', () => {
  it('narrates with a stock voice', async () => {
    const audio = await speak('Hola', { config, fetchImpl: fakeFetch('premade') });
    expect(audio.byteLength).toBe(3);
  });

  it('refuses a cloned voice before generating audio', async () => {
    const f = fakeFetch('cloned');
    await expect(speak('Hola', { config, voiceId: 'clone-1', fetchImpl: f })).rejects.toThrow(ClonedVoiceError);
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([u]) => String(u).includes('text-to-speech'))).toBe(false);
  });

  it('refuses to run offline and makes no request', async () => {
    const prev = process.env.OFRENDA_OFFLINE;
    process.env.OFRENDA_OFFLINE = '1';
    const f = fakeFetch('premade');
    try {
      await expect(speak('Hola', { config, fetchImpl: f })).rejects.toThrow(OfflineError);
      expect(f).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.OFRENDA_OFFLINE;
      else process.env.OFRENDA_OFFLINE = prev;
    }
  });

  it('estimates cost per character', () => {
    expect(estimateTtsCostUsd('x'.repeat(1000))).toBe(0.08);
  });
});
