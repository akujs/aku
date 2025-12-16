import type { RetryOptions } from "../../../helpers/async/retry.ts";
import type { SqliteTransactionMode } from "../../DatabaseClient.ts";

/***/
export interface SqliteDatabaseAdapterConfig {
	/**
	 * The path to the database file, or :memory: to use an in-memory database.
	 */
	path: string;

	/**
	 * If true, open the database in read-only mode.
	 */
	readOnly?: boolean;

	/**
	 * If false, disable the default behaviour of creating the database file and
	 * any missing parent directories if they don't exist.
	 *
	 * @default true
	 */
	create?: boolean;

	/**
	 * If false, disable the default behaviour of enabling write-ahead-logging
	 * (WAL) mode for the database. This is recommended for performance.
	 *
	 * @see https://sqlite.org/wal.html
	 *
	 * @default true
	 */
	useWalMode?: boolean;

	/**
	 * Default retry behaviour for transactions on this adapter. Can be
	 * overridden by passing options to `database.transaction(f, opts)`.
	 *
	 * This option is mandatory because all applications need to consider what
	 * the appropriate retry behaviour is for them. Concurrency errors can and
	 * do happen all the time in production but very rarely in development. This
	 * is especially true when using SQLite In production because it does not
	 * permit concurrent writers. For robustness you should enable retry. But
	 * retrying transactions means that you must make sure your transaction
	 * handlers are idempotent - e.g. they do not make any API calls that can't
	 * be safely repeated.
	 */
	transactionRetry: boolean | number | RetryOptions;

	/**
	 * Default SQLite transaction mode controlling when locks are acquired. Can
	 * be overridden by passing options to `database.transaction(f, opts)`.
	 *
	 * Supported values are `"deferred"` (default), `"immediate"`, and
	 * `"exclusive"`
	 *
	 * @see https://sqlite.org/lang_transaction.html
	 */
	transactionMode?: SqliteTransactionMode | undefined;
}
