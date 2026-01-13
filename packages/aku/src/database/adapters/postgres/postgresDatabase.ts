import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { PostgresDatabaseAdapter } from "./PostgresDatabaseAdapter.ts";
import type { PostgresDatabaseAdapterConfig } from "./PostgresDatabaseAdapterConfig.ts";

/**
 * Create a Postgres database adapter using the postgres.js library
 *
 * @example
 * import postgres from 'postgres'
 * createApplication({
 *   database: postgresDatabase({
 *     sql: postgres( ... postgres.js options ... ),
 *     transactionRetry: true,
 *   }),
 *   ...
 * });
 */
export function postgresDatabase(config: PostgresDatabaseAdapterConfig): DatabaseAdapter {
	return new PostgresDatabaseAdapter(config);
}
