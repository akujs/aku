import type { Sql } from "postgres";

/***/
export interface PostgresDatabaseAdapterConfig {
	/**
	 * A postgres.js instance.
	 *
	 * NOTE: calling dispose() on the PostgresDatabaseAdapter will NOT affect this.
	 */
	sql: Sql;
}
