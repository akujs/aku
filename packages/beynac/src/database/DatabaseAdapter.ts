import type { Statement, StatementResult } from "./contracts/Database.ts";
import type { DatabaseGrammar } from "./grammar/DatabaseGrammar.ts";

export interface DatabaseConfig {
	/**
	 * The default database adapter, used when no name is specified.
	 */
	default: DatabaseAdapter;

	/**
	 * Additional named database adapters.
	 */
	additional?: Record<string, DatabaseAdapter>;
}

/**
 * Interface for database adapters. Implement this to add support for new
 * databases.
 */
export interface DatabaseAdapter<TConnection = unknown> {
	/**
	 * The SQL grammar for this database, used to generate transaction and
	 * savepoint statements.
	 */
	readonly grammar: DatabaseGrammar;

	/**
	 * Whether this adapter supports interactive transactions.
	 * If false, transaction() will throw and only batch() provides atomicity.
	 */
	readonly supportsTransactions: boolean;

	/**
	 * Acquire a connection for use with run() and batch().
	 * For pooled adapters, this reserves a connection from the pool.
	 * For single-connection adapters, this waits until the connection is available.
	 */
	acquireConnection(): Promise<TConnection>;

	/**
	 * Release a connection acquired via acquireConnection().
	 * For pooled adapters, this returns the connection to the pool.
	 * For single-connection adapters, this allows the next waiter to proceed.
	 */
	releaseConnection(connection: TConnection): void;

	/**
	 * Execute a statement using the provided connection.
	 *
	 * The returned object has the following properties:
	 * - `rows`: an array of row objects with column names as keys, empty if the
	 *   query returned no rows, or if this is not the kind of statement that
	 *   returns rows.
	 * - `rowsAffected`: the number of rows affected by the statement, 0 if the
	 *   statement did not modify any rows, or if this is not the kind of
	 *   statement that modifies rows.
	 */
	run(statement: Statement, connection: TConnection): Promise<StatementResult>;

	/**
	 * Execute a batch of statements using the provided connection.
	 *
	 * It is valid to iterate over the statements and execute each one
	 * serially but adapters should use a technique that provides higher
	 * performance if it is available.
	 *
	 * If the adapter supports transactions then this method will be called from
	 * within a transaction. If the adapter does not support transactions and
	 * the underlying database has an appropriate API, it should be implemented
	 * using a transactional batch. Many HTTP databases like Neon and D1 offer
	 * Do not support interactive transactions but do support a transactional
	 * batch API call.
	 */
	batch(statements: Statement[], connection: TConnection): Promise<StatementResult[]>;

	/**
	 * Called when the adapter is no longer required. The convention is that
	 * adapters should clean up / destroy resources that they have created, but
	 * not resources that were passed already initialised via the constructor.
	 */
	dispose(): void;
}
