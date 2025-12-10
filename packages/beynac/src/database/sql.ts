import { Database } from "../facades-entry-point.ts";
import type { DatabaseClient, Row, Statement, StatementResult } from "./contracts/Database.ts";
import { StatementImpl } from "./StatementImpl.ts";

/**
 * A SQL statement created via the `sql` tagged template literal.
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
	 * Return a new Sql instance with its default client set to the named client.
	 */
	on(clientName: string): Sql;

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

export class SqlImpl extends StatementImpl implements Sql {
	readonly #clientName: string | undefined;

	constructor(
		strings: TemplateStringsArray | readonly string[],
		values: unknown[],
		clientName?: string,
	) {
		super(strings, values);
		this.#clientName = clientName;
	}

	on(clientName: string): Sql {
		return new SqlImpl(this.fragments, this.params, clientName);
	}

	run(): Promise<StatementResult> {
		return this.#getClient().run(this);
	}

	all<T = Row>(): Promise<T[]> {
		return this.#getClient().all<T>(this);
	}

	first<T = Row>(): Promise<T> {
		return this.#getClient().first<T>(this);
	}

	firstOrNull<T = Row>(): Promise<T | null> {
		return this.#getClient().firstOrNull<T>(this);
	}

	firstOrFail<T = Row>(): Promise<T> {
		return this.#getClient().firstOrFail<T>(this);
	}

	firstOrNotFound<T = Row>(): Promise<T> {
		return this.#getClient().firstOrNotFound<T>(this);
	}

	scalar<T = unknown>(): Promise<T> {
		return this.#getClient().scalar<T>(this);
	}

	column<T = unknown>(): Promise<T[]> {
		return this.#getClient().column<T>(this);
	}

	// oxlint-disable-next-line unicorn/no-thenable -- intentionally thenable so `await sql`...`` works
	then: Sql["then"] = (onfulfilled, onrejected) => {
		return this.all().then(onfulfilled, onrejected);
	};

	#getClient(): DatabaseClient {
		return Database.client(this.#clientName);
	}
}

// Type for the sql tagged template literal function
export interface SqlFunction {
	(strings: TemplateStringsArray, ...values: unknown[]): Sql;
	// Create a Sql instance from a raw SQL string. Use with caution - the string
	// is not parameterised so must not contain user input.
	raw(sqlString: string): Sql;
}

/**
 * Template literal for creating SQL statements with parameterised values.
 *
 * @example
 * const bobbyTables = "Robert'); DROP TABLE Students;--";
 * // Query will use bound parameter making it immune from SQL injection
 * const rows = await db.all(sql`SELECT * FROM students WHERE name = ${bobbyTables}`);
 */
export const sql: SqlFunction = Object.assign(
	(strings: TemplateStringsArray, ...values: unknown[]): Sql => {
		return new SqlImpl(strings, values);
	},
	{
		raw(sqlString: string): Sql {
			return new SqlImpl([sqlString], []);
		},
	},
);
