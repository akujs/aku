import type { RetryOptions } from "../helpers/async/retry.ts";
import type { Row, Statement, StatementResult } from "./Statement.ts";

export type TransactionRetryOption = boolean | number | RetryOptions;

export interface TransactionOptions {
	retry?: TransactionRetryOption | undefined;
}

/**
 * Represents a connection to a specific database, e.g. a named database on a
 * Postgres server, or a SQLite file on disk.
 */
export interface DatabaseConnection {
	/**
	 * Whether this database supports interactive transactions via
	 * `transaction()`. Databases accessed via HTTP APIs like Cloudflare D1 tend
	 * not to.
	 *
	 * For those databases, this is false and `transaction()` will throw - use
	 * batch() instead.
	 */
	readonly supportsTransactions: boolean;

	/**
	 * The ID of the current transaction, or null if not in a transaction.
	 *
	 * Transactions can be nested and each nested transaction will create a new transaction ID.
	 */
	readonly transactionId: number | null;

	/**
	 * The ID of the top-level transaction, or null if not in a transaction.
	 *
	 * When creating nested transactions this does not change - it always refers
	 * to the outermost transaction ID.
	 */
	readonly outerTransactionId: number | null;

	/**
	 * The current transaction nesting depth.
	 *
	 * 0 = not in a transaction, 1 = in root transaction, 2+ = in a nested transaction.
	 */
	readonly transactionDepth: number;

	/**
	 * Execute a statement and return the result.
	 *
	 * The returned object has `rows` and `rowsAffected` properties.
	 *
	 * - For statements that return rows (e.g. SELECT), `rows` contains the
	 *   returned data and `rowsAffected` equals `rows.length`.
	 * - For modification queries (e.g. INSERT/UPDATE etc), `rows` is empty and
	 *   `rowsAffected` is the number of modified rows.
	 * - For DDL (e.g. CREATE TABLE etc), both are 0/empty.
	 */
	run(statement: Statement): Promise<StatementResult>;

	/**
	 * Execute a batch of statements atomically. These are wrapped in a
	 * transaction and if any statement fails the whole batch is rolled back.
	 */
	batch(statements: Statement[]): Promise<StatementResult[]>;

	/**
	 * Execute an interactive transaction. Within this transaction, any database
	 * operations will become part of the transaction, and will be rolled back
	 * if the transaction fails. If the function throws any error, the
	 * transaction will be rolled back. Calls to transaction or batch will
	 * create nested transactions that can roll back independently.
	 *
	 * Throws if the underlying adapter does not support transactions. Check
	 * `supportsTransactions` to see if this database does.
	 *
	 * @param options.retry retry on concurrency errors like deadlocks or write
	 * conflict. When a concurrency error is detected, the transaction is rolled
	 * back and retried with exponential backoff.
	 * - `true` - retry with default options (5 attempts, 100ms starting delay)
	 * - `false` - no retry (default)
	 * - `number` - retry with that many max attempts
	 * - `RetryOptions` - full control over retry behaviour, see the withRetry
	 *   async helper
	 */
	transaction<T>(fn: () => Promise<T>, options?: TransactionOptions): Promise<T>;

	/**
	 * Clean up any resources created by this adapter. Some adapters accept
	 * connections through the constructor and these will not be affected by
	 * this method. Safe to call multiple times.
	 */
	dispose(): void;

	/**
	 * Execute a statement and return all rows.
	 */
	all<T = Row>(statement: Statement): Promise<T[]>;

	/**
	 * Execute a statement and return the first row.
	 * Throws if no rows are returned.
	 */
	first<T = Row>(statement: Statement): Promise<T>;

	/**
	 * Execute a statement and return the first row, or null if no rows.
	 */
	firstOrNull<T = Row>(statement: Statement): Promise<T | null>;

	/**
	 * Execute a statement and return the first row.
	 * Throws QueryError if no rows are returned.
	 */
	firstOrFail<T = Row>(statement: Statement): Promise<T>;

	/**
	 * Execute a statement and return the first row.
	 * Throws via abort.notFound() if no rows are returned.
	 */
	firstOrNotFound<T = Row>(statement: Statement): Promise<T>;

	/**
	 * Execute a statement and return the first column of the first row.
	 * Throws QueryError if no rows are returned.
	 */
	scalar<T = unknown>(statement: Statement): Promise<T>;

	/**
	 * Execute a statement and return the first column of each row as an array.
	 */
	column<T = unknown>(statement: Statement): Promise<T[]>;
}
