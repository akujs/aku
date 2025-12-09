import type { Statement, StatementResult } from "./contracts/Database.ts";

/**
 * Interface for database adapters.
 */
export interface DatabaseAdapter {
	/**
	 * Execute a statement.
	 *
	 * The returned object has the following properties:
	 * - `rows`: an array of row objects with column names as keys, empty if the
	 *   query returned no rows, or if this is not the kind of statement that
	 *   returns rows.
	 * - `rowsAffected`: the number of rows affected by the statement, 0 if the
	 *   statement did not modify any rows, or if this is not the kind of
	 *   statement that modifies rows.
	 */
	run(statement: Statement): Promise<StatementResult>;

	/**
	 * Execute a batch of statements atomically. These should be wrapped in a
	 * transaction and if any statement fails the whole batch is rolled back.
	 */
	batch(statements: Statement[]): Promise<StatementResult[]>;

	/**
	 * Run code in an interactive transaction. If not present, the adapter does
	 * not support interactive transactions
	 */
	transaction?<T>(fn: () => Promise<T>): Promise<T>;

	/**
	 * Called when the adapter is no longer required. The convention is that
	 * adapters should clean up / destroy resources that they have created, but
	 * not resources that were passed already initialised via the constructor.
	 */
	dispose(): void;
}
