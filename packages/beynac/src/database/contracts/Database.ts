import { createTypeToken, type TypeToken } from "../../container/container-key.ts";

export interface Statement {
	sql: string;
	params: unknown[];
}

export interface StatementResult {
	columnNames: string[];
	rows: Record<string, unknown>[];
	rowsAffected: number;
}

/**
 * Represents a connection to a specific database, e.g. a named database on a
 * Postgres server, or a SQLite file on disk.
 */
export interface Database {
	/**
	 * Execute a statement and return the result. Works for all statement types:
	 * SELECT, INSERT, UPDATE, DELETE, and DDL statements like CREATE TABLE.
	 *
	 * For SELECT statements, `rows` contains the returned data and `rowsAffected`
	 * equals `rows.length`. For INSERT/UPDATE/DELETE, `rows` is empty and
	 * `rowsAffected` is the number of modified rows. For DDL, both are 0/empty.
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
}

export const Database: TypeToken<Database> = createTypeToken("Database");
