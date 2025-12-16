import type { Sql } from "postgres";
import type { RetryOptions } from "../../../helpers/async/retry.ts";
import type { IsolationLevel } from "../../DatabaseClient.ts";

/***/
export interface PostgresDatabaseAdapterConfig {
	/**
	 * A postgres.js instance.
	 *
	 * NOTE: calling dispose() on the PostgresDatabaseAdapter will NOT affect this.
	 */
	sql: Sql;

	/**
	 * Default retry behaviour for transactions on this adapter. Can be
	 * overridden by passing options to `database.transaction(f, opts)`.
	 *
	 * This option is mandatory because all applications need to consider what
	 * the appropriate retry behaviour is for them. Concurrency errors can and
	 * do happen all the time in production but very rarely in development. For
	 * robustness you should enable retry. But retrying transactions means that
	 * you must make sure your transaction handlers are idempotent - e.g. they
	 * do not make any API calls that can't be safely repeated.
	 */
	transactionRetry: boolean | number | RetryOptions;

	/**
	 * Default transaction isolation level for this adapter. Can be overridden
	 * by passing options to `database.transaction(f, opts)`.
	 *
	 * Supported values are `"read-committed"`, `"repeatable-read"` and
	 * `"serializable"`.
	 */
	transactionIsolation?: IsolationLevel | undefined;
}
