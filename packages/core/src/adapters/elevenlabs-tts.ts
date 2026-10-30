/**
 * ElevenLabs text-to-speech: the ofrenda's narrator voice (SPEC §7 step 7, §10).
 *
 * Stock voices only. The ofrenda never speaks *as* the person who died, so a cloned or professional
 * (also cloned) voice is refused before any audio is generated. Offline mode refuses the call
 * entirely, with no request made.
 */

import { getConfig, type Config } from '../config.js';
import { assertCloudAllowed } from '../offline.js';

const API = 'https://api.elevenlabs.io/v1';
/** The ElevenLabs model for narration; multilingual, so one voice reads Spanish and English. */
export const DEFAULT_TTS_MODEL = 'eleven_multilingual_v2';

export interface SpeakOptions {
  voiceId?: string;
  modelId?: string;
  config?: Config;
  fetchImpl?: typeof fetch;
}

export class ClonedVoiceError extends Error {
  constructor(voiceId: string, category: string) {
    super(`Voice ${voiceId} is a ${category} voice. Ofrenda narrates with stock voices only.`);
    this.name = 'ClonedVoiceError';
  }
}

const checkedVoices = new Map<string, string>();

/** Look up a voice's category once per process and refuse clones. */
export async function assertStockVoice(voiceId: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  let category = checkedVoices.get(voiceId);
  if (!category) {
    const res = await fetchImpl(`${API}/voices/${encodeURIComponent(voiceId)}`, { headers: { 'xi-api-key': apiKey } });
    if (!res.ok) throw new Error(`ElevenLabs voice lookup failed: HTTP ${res.status}`);
    category = ((await res.json()) as { category?: string }).category ?? 'unknown';
    checkedVoices.set(voiceId, category);
  }
  if (category === 'cloned' || category === 'professional') throw new ClonedVoiceError(voiceId, category);
}

/** Narrate `text`; returns MP3 bytes. */
export async function speak(text: string, options: SpeakOptions = {}): Promise<Uint8Array> {
  assertCloudAllowed('elevenlabs-tts');
  const config = options.config ?? getConfig();
  const apiKey = config.elevenlabs.apiKey;
  if (!apiKey) throw new Error('Narration needs ELEVENLABS_API_KEY.');
  const fetchImpl = options.fetchImpl ?? fetch;
  const voiceId = options.voiceId ?? config.elevenlabs.voiceId;
  await assertStockVoice(voiceId, apiKey, fetchImpl);

  const res = await fetchImpl(`${API}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: options.modelId ?? DEFAULT_TTS_MODEL,
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs text-to-speech failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Rough cost for the post and traces: $0.08 per 1,000 characters (ElevenLabs API pricing, 2026-10). */
export function estimateTtsCostUsd(text: string): number {
  return Math.round((text.length / 1000) * 0.08 * 10000) / 10000;
}
