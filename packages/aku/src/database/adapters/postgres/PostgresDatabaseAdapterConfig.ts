import type { Sql } from "postgres";
import type { RetryOptions } from "../../../helpers/async/retry.ts";
import type { IsolationLevel } from "../../DatabaseClient.ts";

/***/
export interface PostgresDatabaseAdapterConfig {
	/**
	 * A postgres.js instance.
	 *
	 * NOTE: calling dispose() on the PostgresDatabaseAdapter does not close
	 * this client, you are responsible for closing it yourself.
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

	/**
	 * Whether to use cached prepared statements. Only supported by the Postgres
	 * adapter.
	 *
	 * When enabled (the default), statements are prepared and cached based on
	 * the SQL string, so future queries using the same string will use the same
	 * prepared statement. This improves performance significantly.
	 *
	 * To save memory use on the server, you may want to disable prepared
	 * statements when you know a statement will not be reused often, either by
	 * default using this option, or per-query using `query.withPrepare(false)`.
	 *
	 * Can be overridden per-query using `statement.withPrepare(false)`.
	 *
	 * @default true
	 */
	prepare?: boolean | undefined;
}
