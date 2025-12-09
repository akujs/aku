import { Database } from "../facades.ts";
import type { DatabaseConnection, Row, Statement, StatementResult } from "./contracts/Database.ts";
import { StatementImpl } from "./StatementImpl.ts";

/**
 * A SQL statement created via the `sql` tagged template literal
 *
 * @example
 * // Get all rows using the default database connection
 * const users = await sql`SELECT * FROM users`;
 *
 * // Get first row using the a name connection
 * const user = await sql`SELECT * FROM events`.on("analytics").all();
 */
export interface Sql extends Statement {
	/**
	 * Execute this statement on a named database connection.
	 * Returns a new Sql instance bound to that connection.
	 */
	on(connectionName: string): Sql;

	/**
	 * Execute the statement and return the raw result with rows and rowsAffected.
	 * A SQL statement that can be executed on a database connection.
	 */
	run(): Promise<StatementResult>;

	/**
	 * Execute and return all rows.
	 */
	all<T = Row>(): Promise<T[]>;

	/**
	 * Execute and return the first row. Throws if no rows returned.
	 */
	first<T = Row>(): Promise<T>;

	/**
	 * Execute and return the first row, or null if no rows returned.
	 */
	firstOrNull<T = Row>(): Promise<T | null>;

	/**
	 * Execute and return the first row. Throws AssertionError if no rows returned.
	 */
	firstOrFail<T = Row>(): Promise<T>;

	/**
	 * Execute and return the first row. Throws NotFoundError if no rows returned.
	 */
	firstOrNotFound<T = Row>(): Promise<T>;

	/**
	 * Execute and return the first column of the first row.
	 */
	scalar<T = unknown>(): Promise<T>;

	/**
	 * Execute and return the first column of all rows.
	 */
	column<T = unknown>(): Promise<T[]>;

	/**
	 * Allows awaiting the Sql object directly, equivalent to calling all().
	 */
	then: Promise<Row[]>["then"];
}

class SqlImpl extends StatementImpl implements Sql {
	readonly #connectionName: string | undefined;

	constructor(
		strings: TemplateStringsArray | readonly string[],
		values: unknown[],
		connectionName?: string,
	) {
		super(strings, values);
		this.#connectionName = connectionName;
	}

	#getConnection(): DatabaseConnection {
		return Database.connection(this.#connectionName);
	}

	on(connectionName: string): Sql {
		return new SqlImpl(this.fragments, this.params, connectionName);
	}

	run(): Promise<StatementResult> {
		return this.#getConnection().run(this);
	}

	all<T = Row>(): Promise<T[]> {
		return this.#getConnection().all<T>(this);
	}

	first<T = Row>(): Promise<T> {
		return this.#getConnection().first<T>(this);
	}

	firstOrNull<T = Row>(): Promise<T | null> {
		return this.#getConnection().firstOrNull<T>(this);
	}

	firstOrFail<T = Row>(): Promise<T> {
		return this.#getConnection().firstOrFail<T>(this);
	}

	firstOrNotFound<T = Row>(): Promise<T> {
		return this.#getConnection().firstOrNotFound<T>(this);
	}

	scalar<T = unknown>(): Promise<T> {
		return this.#getConnection().scalar<T>(this);
	}

	column<T = unknown>(): Promise<T[]> {
		return this.#getConnection().column<T>(this);
	}

	// eslint-disable-next-line unicorn/no-thenable -- intentionally thenable so `await sql`...`` works
	then: Sql["then"] = (onfulfilled, onrejected) => {
		return this.all().then(onfulfilled, onrejected);
	};
}

/**
 * Tagged template literal for creating SQL statements with parameterized values.
 *
 * @example
 * const userId = 123;
 * const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Sql {
	return new SqlImpl(strings, values);
}
