import { Database } from "../facades.ts";
import { BaseClass } from "../utils.ts";
import type { Row, Statement, StatementResult } from "./contracts/Database.ts";

/**
 * A SQL statement created via the `sql` tagged template literal. Can be
 * executed directly by awaiting it, or via methods for different result types.
 *
 * @example
 * // Get all rows (default when awaited)
 * const users = await sql`SELECT * FROM users`;
 *
 * // Get first row or null
 * const user = await sql`SELECT * FROM users WHERE id = ${id}`.firstOrNull();
 *
 * // Get a single scalar value
 * const count = await sql`SELECT COUNT(*) FROM users`.scalar<number>();
 */
export interface Sql extends Statement {
	/** Execute the statement and return the raw result with rows and rowsAffected. */
	run(): Promise<StatementResult>;
	/** Execute and return all rows. */
	all<T = Row>(): Promise<T[]>;
	/** Execute and return the first row. Throws if no rows returned. */
	first<T = Row>(): Promise<T>;
	/** Execute and return the first row, or null if no rows returned. */
	firstOrNull<T = Row>(): Promise<T | null>;
	/** Execute and return the first row. Throws AssertionError if no rows returned. */
	firstOrFail<T = Row>(): Promise<T>;
	/** Execute and return the first row. Throws NotFoundError if no rows returned. */
	firstOrNotFound<T = Row>(): Promise<T>;
	/** Execute and return the first column of the first row. */
	scalar<T = unknown>(): Promise<T>;
	/** Execute and return the first column of all rows. */
	column<T = unknown>(): Promise<T[]>;
	/** Allows awaiting the Sql object directly, equivalent to calling all(). */
	then: Promise<Row[]>["then"];
}

class SqlImpl extends BaseClass implements Sql {
	readonly fragments: readonly string[];
	readonly params: unknown[];

	constructor(strings: TemplateStringsArray, values: unknown[]) {
		super();
		this.fragments = strings;
		this.params = values;
	}

	run(): Promise<StatementResult> {
		return Database.run(this);
	}

	all<T = Row>(): Promise<T[]> {
		return Database.all<T>(this);
	}

	first<T = Row>(): Promise<T> {
		return Database.first<T>(this);
	}

	firstOrNull<T = Row>(): Promise<T | null> {
		return Database.firstOrNull<T>(this);
	}

	firstOrFail<T = Row>(): Promise<T> {
		return Database.firstOrFail<T>(this);
	}

	firstOrNotFound<T = Row>(): Promise<T> {
		return Database.firstOrNotFound<T>(this);
	}

	scalar<T = unknown>(): Promise<T> {
		return Database.scalar<T>(this);
	}

	column<T = unknown>(): Promise<T[]> {
		return Database.column<T>(this);
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
 * const stmt = sql`SELECT * FROM users WHERE id = ${userId}`;
 */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Sql {
	return new SqlImpl(strings, values);
}

export function renderStatementSql(
	statement: Statement,
	renderPlaceholder: (index: number) => string,
): string {
	const { fragments, params } = statement;
	let result = "";
	for (let i = 0; i < fragments.length; i++) {
		result += fragments[i];
		if (i < params.length) {
			result += renderPlaceholder(i);
		}
	}
	return result;
}

export function renderStatementForLogs(statement: Statement): string {
	return renderStatementSql(
		statement,
		(i) => `[Param#${i + 1}: ${renderParam(statement.params[i])}]`,
	);
}

function renderParam(value: unknown): string {
	let str = "";
	try {
		str = JSON.stringify(value);
	} catch {}
	str ||= String(value);

	const maxLength = 100;

	if (str.length > maxLength + 30) {
		const hidden = str.length - maxLength;
		return `${str.slice(0, maxLength)}...hiding ${hidden} more chars`;
	}
	return str;
}
