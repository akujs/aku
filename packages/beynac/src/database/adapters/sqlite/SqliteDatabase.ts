import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { SqliteDatabaseAdapter } from "./SqliteDatabaseAdapter.ts";
import type { SqliteDatabaseAdapterConfig } from "./SqliteDatabaseAdapterConfig.ts";

/**
 * Create a Sqlite database adapter
 *
 * @param config Configuration for the database
 *
 * @example
 * createApplication({
 *   database: sqliteDatabase({
 *     rootPath: '/var/storage/sqlite.db'
 *   }),
 *   ...
 * });
 */
export function sqliteDatabase(config: SqliteDatabaseAdapterConfig): DatabaseAdapter {
	return new SqliteDatabaseAdapter(config);
}
