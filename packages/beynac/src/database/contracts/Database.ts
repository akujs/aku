import { createTypeToken, type TypeToken } from "../../container/container-key.ts";

export interface Statement {
	readonly fragments: readonly string[];
	readonly params: unknown[];
}

export interface StatementResult {
	rows: Record<string, unknown>[];
	rowsAffected: number;
}

/**
 * Represents a connection to a specific database, e.g. a named database on a
 * Postgres server, or a SQLite file on disk.
 */
export interface Database {
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
	 */
	transaction<T>(fn: () => Promise<T>): Promise<T>;

	/**
	 * Clean up any resources created by this adapter. Some adapters accept
	 * connections through the constructor and these will not be affected by
	 * this method. Safe to call multiple times.
	 */
	dispose(): void | Promise<void>;
}

export const Database: TypeToken<Database> = createTypeToken("Database");
