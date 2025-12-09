import { Database } from "../facades.ts";
import { BaseClass } from "../utils.ts";
import type { Row, Statement, StatementResult } from "./contracts/Database.ts";

export interface Sql extends Statement {
	run(): Promise<StatementResult>;
	all<T = Row>(): Promise<T[]>;
	first<T = Row>(): Promise<T>;
	firstOrNull<T = Row>(): Promise<T | null>;
	firstOrFail<T = Row>(): Promise<T>;
	firstOrNotFound<T = Row>(): Promise<T>;
	scalar<T = unknown>(): Promise<T>;
	column<T = unknown>(): Promise<T[]>;
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
