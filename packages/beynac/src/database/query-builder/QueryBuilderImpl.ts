import { BaseClass } from "../../utils.ts";
import type { DatabaseGrammar } from "../grammar/DatabaseGrammar.ts";
import type { SqlFragments, Statement } from "../Statement.ts";
import { MutableQueryBuilder } from "./MutableQueryBuilder.ts";
import type { PlaceholderArgs } from "./placeholder-types.ts";
import type {
	DefaultColumnsQueryBuilder,
	LockOptions,
	SelectQueryBuilder,
} from "./QueryBuilder.ts";
import { toHumanReadableSql } from "./statement-render.ts";
import { toStatement } from "./statement-utils.ts";

export class QueryBuilderImpl extends BaseClass implements Statement {
	readonly #from: SqlFragments;
	readonly #grammar: DatabaseGrammar;
	readonly #commands: Command[];
	readonly #length: number;
	#cachedBuild: { fragments: readonly string[]; params: unknown[] } | null = null;

	constructor(from: SqlFragments, grammar: DatabaseGrammar, commands: Command[]) {
		super();
		this.#from = from;
		this.#grammar = grammar;
		this.#commands = commands;
		this.#length = commands.length;
	}

	get fragments(): readonly string[] {
		return this.#getBuild().fragments;
	}

	get params(): unknown[] {
		return this.#getBuild().params;
	}

	toHumanReadableSql(): string {
		return toHumanReadableSql(this.#getBuild());
	}

	// Join methods - support both string+values and Statement overloads
	join<S extends string>(clause: S, ...values: PlaceholderArgs<S>): this;
	join(statement: Statement): this;
	join(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["JOIN", stmt]);
	}

	innerJoin<S extends string>(clause: S, ...values: PlaceholderArgs<S>): this;
	innerJoin(statement: Statement): this;
	innerJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["INNER JOIN", stmt]);
	}

	leftJoin<S extends string>(clause: S, ...values: PlaceholderArgs<S>): this;
	leftJoin(statement: Statement): this;
	leftJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["LEFT JOIN", stmt]);
	}

	rightJoin<S extends string>(clause: S, ...values: PlaceholderArgs<S>): this;
	rightJoin(statement: Statement): this;
	rightJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["RIGHT JOIN", stmt]);
	}

	fullJoin<S extends string>(clause: S, ...values: PlaceholderArgs<S>): this;
	fullJoin(statement: Statement): this;
	fullJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["FULL OUTER JOIN", stmt]);
	}

	crossJoin(table: string): this {
		return this.#derive("pushJoin", ["CROSS JOIN", { fragments: [table], params: [] }]);
	}

	// Select methods
	select(...columns: string[]): SelectQueryBuilder {
		return this.#derive("setSelect", [columns]) as unknown as SelectQueryBuilder;
	}

	addSelect(...columns: string[]): this {
		return this.#derive("pushSelect", [columns]);
	}

	replaceSelect(...columns: string[]): this {
		return this.#derive("setSelect", [columns]);
	}

	// WHERE - support both string+values and Statement overloads
	where<S extends string>(condition: S, ...values: PlaceholderArgs<S>): this;
	where(statement: Statement): this;
	where(conditionOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(conditionOrStatement, values);
		return this.#derive("pushWhere", [stmt]);
	}

	// Grouping
	groupBy(...columns: string[]): this {
		return this.#derive("pushGroupBy", [columns]);
	}

	// HAVING - support both string+values and Statement overloads
	having<S extends string>(condition: S, ...values: PlaceholderArgs<S>): this;
	having(statement: Statement): this;
	having(conditionOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(conditionOrStatement, values);
		return this.#derive("pushHaving", [stmt]);
	}

	// Ordering
	orderBy(...columns: string[]): this {
		return this.#derive("pushOrderBy", [columns]);
	}

	replaceOrderBy(...columns: string[]): this {
		return this.#derive("setOrderBy", [columns]);
	}

	// Pagination
	limit(n: number): this {
		return this.#derive("setLimit", [n]);
	}

	offset(n: number): this {
		return this.#derive("setOffset", [n]);
	}

	// Modifiers
	distinct(): this {
		return this.#derive("setDistinct", []);
	}

	forUpdate(options?: LockOptions): this {
		return this.#derive("setLock", ["UPDATE", options]);
	}

	forShare(options?: LockOptions): this {
		return this.#derive("setLock", ["SHARE", options]);
	}

	static from(table: string, grammar: DatabaseGrammar): DefaultColumnsQueryBuilder {
		return new QueryBuilderImpl(
			{ fragments: [table], params: [] },
			grammar,
			[],
		) as DefaultColumnsQueryBuilder;
	}

	#derive<K extends keyof MutableQueryBuilder>(
		method: K,
		args: Parameters<MutableQueryBuilder[K]>,
	): this {
		let commands = this.#commands;

		if (commands.length > this.#length) {
			// We've already derived from this builder, we need to clone the array
			commands = commands.slice(0, this.#length);
		}

		commands.push([method, args]);
		return new QueryBuilderImpl(this.#from, this.#grammar, commands) as this;
	}

	#getBuild(): SqlFragments {
		if (!this.#cachedBuild) {
			const builder = new MutableQueryBuilder(this.#from, this.#grammar);
			for (let i = 0; i < this.#length; i++) {
				const [method, args] = this.#commands[i];
				(builder[method] as (...a: unknown[]) => void)(...args);
			}
			this.#cachedBuild = builder.compile();
		}
		return this.#cachedBuild;
	}
}

type Command = [keyof MutableQueryBuilder, unknown[]];

function resolveToStatement(
	conditionOrStatement: string | Statement,
	values: unknown[],
): SqlFragments {
	if (typeof conditionOrStatement === "string") {
		return toStatement(conditionOrStatement, values);
	}
	// It's already a Statement - extract fragments and params
	return {
		fragments: [...conditionOrStatement.fragments],
		params: [...conditionOrStatement.params],
	};
}
