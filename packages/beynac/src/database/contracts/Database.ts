import { createTypeToken, type TypeToken } from "../../container/container-key.ts";

export interface Statement {
	sql: string;
	params: unknown[];
}

export interface QueryResult {
	columnNames: string[];
	rows: Record<string, unknown>[];
}

export interface ExecuteResult {
	rowsAffected: number;
}

/**
 * Represents a connection to a specific database, e.g. a named database on a
 * Postgres server, or a SQLite file on disk.
 */
export interface Database {
	/**
	 * Execute a query statement and return the result
	 */
	query(statement: Statement): Promise<QueryResult>;

	/**
	 * Execute a statement that does not generate results, like INSERT, UPDATE, DELETE or CREATE TABLE
	 */
	execute(statement: Statement): Promise<ExecuteResult>;

	/**
	 * Execute a batch of statements atomically. These are wrapped in a
	 * transaction and if any statement fails the whole batch is rolled back.
	 */
	batch(statements: Statement[]): Promise<ExecuteResult[]>;

	/**
	 * Execute an interactive transaction. Within this transaction, any calls to
	 * execute, query will become part of the transaction, and will be rolled
	 * back if the transaction fails. Calls to transaction or batch will create
	 * nested transactions that can roll back independently.
	 */
	transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export const Database: TypeToken<Database> = createTypeToken("Database");
