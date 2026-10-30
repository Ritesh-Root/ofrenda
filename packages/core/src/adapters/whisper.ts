/**
 * Local speech-to-text: whisper.cpp through `nodejs-whisper` 0.4.1 (SPEC §7 step 1).
 *
 * Loaded lazily on purpose. `nodejs-whisper` ships a native addon; when it is not built (a fresh
 * clone, CI without a compiler) importing it at module scope would take down every command that
 * merely imports the ingest pipeline. Instead the import happens on first use and `isWhisperBuilt()`
 * lets tests and `ofrenda doctor` ask first.
 *
 * Nothing here touches the network: whisper.cpp runs in-process on the family's laptop.
 */

export interface WhisperResult {
  text: string;
  /** The model that produced the transcript, e.g. `base`. */
  model: string;
}

export interface WhisperOptions {
  /** whisper.cpp model name. SPEC §7 says `base`; `small` if the CPU allows. */
  model?: string;
  /** Where downloaded ggml models live. Defaults to `models/` under the current directory. */
  modelRootPath?: string;
}

/** True when the native addon loads, i.e. the transcript test can run. */
export async function isWhisperBuilt(): Promise<boolean> {
  try {
    await import('nodejs-whisper');
    return true;
  } catch {
    return false;
  }
}

/** Transcribe one audio file to text. Throws when the addon or the model is missing. */
export async function transcribeAudio(
  audioPath: string,
  options: WhisperOptions = {},
): Promise<WhisperResult> {
  const model = options.model ?? 'base';
  const { nodewhisper } = await import('nodejs-whisper');
  const text = await nodewhisper(audioPath, {
    modelName: model,
    modelRootPath: options.modelRootPath ?? 'models',
    autoDownloadModelName: model,
    removeWavFileAfterTranscription: false,
    withCuda: false,
    whisperOptions: {
      language: 'auto',
      outputInText: true,
      noGpu: true,
    },
  });
  return { text: text.trim(), model };
}
