/**
 * @ofrenda/core — everything the CLI and the web app share (SPEC §3).
 *
 * The barrel is the package's external interface, so it stays intentional: config, the offline guard,
 * model access, the database, hybrid search, the grounded answer, ingest activities and the seed
 * loader. Anything not exported here is an implementation detail of one module.
 *
 * Relative imports inside the package keep the `.js` extension even though the sources are `.ts`
 * (NodeNext ESM), and scripts run through tsx so both work in dev and after `tsc`.
 */

export * from './config.js';
export * from './offline.js';
export * from './model.js';
export * from './search.js';
export * from './answer.js';
export * from './seed.js';

export * from './db/queries.js';
export { migrate, readSchema, type MigrateReport } from './db/migrate.js';

export * from './ingest/transcribe.js';
export * from './ingest/save.js';
export * from './ingest/embed.js';
export * from './ingest/extract.js';
export * from './ingest/remembrance.js';
export * from './ingest/run-local.js';

export * from './prompts/extract.js';
export * from './prompts/answer.js';
export * from './prompts/remembrance.js';

export * from './adapters/whisper.js';

/** Version of the workspace package, not of the product. */
export const CORE_PACKAGE_VERSION = '0.0.0';
