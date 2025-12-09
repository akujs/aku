import type { Row, Statement, StatementResult } from "./Statement.ts";

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
	 * Execute an interactive transaction. Within this transaction, any calls to
	 * run will become part of the transaction, and will be rolled back if the
	 * transaction fails. Calls to transaction or batch will create nested
	 * transactions that can roll back independently.
	 *
	 * Throws if the underlying adapter does not support transactions.
	 */
	transaction<T>(fn: () => Promise<T>): Promise<T>;

	/**
	 * Clean up any resources created by this adapter. Some adapters accept
	 * connections through the constructor and these will not be affected by
	 * this method. Safe to call multiple times.
	 */
	dispose(): void | Promise<void>;

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
