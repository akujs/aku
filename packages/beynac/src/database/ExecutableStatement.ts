import type { Row, Statement, StatementResult } from "./Statement.ts";

/**
 * A SQL statement created via the `sql` tagged template literal, with methods
 * to execute it directly against the default or a named database client.
 */
export interface ExecutableStatement extends Statement {
	/**
	 * Return a new Sql instance with its default client set to the named client.
	 */
	on(clientName: string): ExecutableStatement;

	/**
	 * Execute the statement on the default client and return the raw result
	 * with rows and rowsAffected.
	 */
	run(): Promise<StatementResult>;

	/**
	 * Execute the statement on the default client and return all rows.
	 */
	all<T = Row>(): Promise<T[]>;

	/**
	 * Execute the statement on the default client and return the first row.
	 * Throws if no rows returned.
	 */
	first<T = Row>(): Promise<T>;

	/**
	 * Execute the statement on the default client and return the first row, or
	 * null if no rows returned.
	 */
	firstOrNull<T = Row>(): Promise<T | null>;

	/**
	 * Execute the statement on the default client and return the first row.
	 * Throws AssertionError if no rows returned.
	 */
	firstOrFail<T = Row>(): Promise<T>;

	/**
	 * Execute the statement on the default client and return the first row.
	 * Throws NotFoundError if no rows returned.
	 */
	firstOrNotFound<T = Row>(): Promise<T>;

	/**
	 * Execute the statement on the default client and return the first column
	 * of the first row.
	 */
	scalar<T = unknown>(): Promise<T>;

	/**
	 * Execute the statement on the default client and return the first column of all rows.
	 */
	column<T = unknown>(): Promise<T[]>;

	/**
	 * This `then` method allows awaiting the Sql object directly
	 *
	 * The return type is equivalent to calling all().
	 *
	 * @example
	 * const allRows = await sql`SELECT * FROM users`;
	 */
	then: Promise<Row[]>["then"];
}
