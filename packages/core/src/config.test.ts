import { describe, expect, it, afterEach } from 'vitest';

import { ConfigError, getConfig, loadConfig, resetConfigCache } from './config.js';

describe('config', () => {
  afterEach(() => {
    resetConfigCache();
    delete process.env.OFRENDA_MODEL;
  });

  it('fills every default from SPEC §4 when the environment is empty', () => {
    const config = loadConfig({});
    expect(config).toMatchObject({
      offline: false,
      ollamaUrl: 'http://127.0.0.1:11434',
      model: 'gemma3:4b',
      embedModel: 'embeddinggemma',
      stt: 'local',
      tts: 'browser',
      temporalAddress: '127.0.0.1:7233',
      demo: false,
    });
    expect(config.databaseUrl).toContain('127.0.0.1:5432/ofrenda');
    expect(config.elevenlabs.voiceId).toBe('EXAVITQu4vr4xnSDxMaL');
  });

  it('reads OFRENDA_OFFLINE=1 as offline', () => {
    expect(loadConfig({ OFRENDA_OFFLINE: '1' }).offline).toBe(true);
    expect(loadConfig({ OFRENDA_OFFLINE: '0' }).offline).toBe(false);
  });

  it('treats an empty value as unset, which is what .env.example leaves behind', () => {
    const config = loadConfig({ ELEVENLABS_API_KEY: '', SERPAPI_API_KEY: '' });
    expect(config.elevenlabs.apiKey).toBeUndefined();
    expect(config.serpapiKey).toBeUndefined();
  });

  it('rejects an invalid flag with the variable name in the message', () => {
    expect(() => loadConfig({ OFRENDA_OFFLINE: 'yes' })).toThrow(ConfigError);
    expect(() => loadConfig({ OFRENDA_OFFLINE: 'yes' })).toThrow(/OFRENDA_OFFLINE/);
  });

  it('rejects an unknown STT provider instead of silently falling back to local', () => {
    expect(() => loadConfig({ OFRENDA_STT: 'whisper-cloud' })).toThrow(/OFRENDA_STT/);
  });

  it('memoises the process config until the cache is reset', () => {
    process.env.OFRENDA_MODEL = 'gemma3:1b';
    expect(getConfig().model).toBe('gemma3:1b');
    process.env.OFRENDA_MODEL = 'gemma3:4b';
    expect(getConfig().model).toBe('gemma3:1b');
    resetConfigCache();
    expect(getConfig().model).toBe('gemma3:4b');
  });
});
