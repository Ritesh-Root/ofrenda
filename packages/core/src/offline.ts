/**
 * The offline guard (SPEC §4).
 *
 * One rule, enforced in one place: when `OFRENDA_OFFLINE=1` a cloud adapter must throw `OfflineError`
 * *before* it reaches the network. Adapters call `assertCloudAllowed('<name>')` as their first
 * statement; nothing catches `OfflineError` to fall back to a cloud path, because there is no cloud
 * path when the family unplugs the laptop.
 *
 * Nothing here imports a network library, so the guard itself can never make a request.
 */

export class OfflineError extends Error {
  /** The adapter that refused to run, e.g. `elevenlabs-stt`. */
  readonly adapter: string;

  constructor(adapter: string) {
    super(
      `${adapter} is a cloud adapter and Ofrenda is offline (OFRENDA_OFFLINE=1). ` +
        `Everything local keeps working; this feature needs the network and a key.`,
    );
    this.name = 'OfflineError';
    this.adapter = adapter;
  }
}

/** Read the flag at call time, never at import time, so a test can flip it mid-process. */
export function isOffline(env: Record<string, string | undefined> = process.env): boolean {
  return env.OFRENDA_OFFLINE === '1';
}

/** Throw `OfflineError` when offline. Call this first in every cloud adapter. */
export function assertCloudAllowed(
  adapter: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (isOffline(env)) throw new OfflineError(adapter);
}
