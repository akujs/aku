import { BaseClass } from "../../utils.ts";
import type { DatabaseGrammar } from "../grammar/DatabaseGrammar.ts";
import type {
	AnyQueryBuilder,
	LockOptions,
	MutationResult,
	QueryBuilder,
	SqlFragments,
	Statement,
	StringOrFragment,
} from "../query-types.ts";
import { MutableQueryBuilder } from "./MutableQueryBuilder.ts";
import { toHumanReadableSql } from "./statement-render.ts";
import { splitSqlToFragments } from "./statement-utils.ts";

export class QueryBuilderImpl extends BaseClass implements AnyQueryBuilder {
	readonly #from: SqlFragments;
	readonly #grammar: DatabaseGrammar;
	readonly #commands: Command[];
	readonly #length: number;
	#cachedBuild: SqlFragments | null = null;

	constructor(from: SqlFragments, grammar: DatabaseGrammar, commands: Command[]) {
		super();
		this.#from = from;
		this.#grammar = grammar;
		this.#commands = commands;
		this.#length = commands.length;
	}

	get sqlFragments(): readonly StringOrFragment[] {
		return this.#getBuild().sqlFragments;
	}

	toHumanReadableSql(): string {
		return toHumanReadableSql(this.#getBuild());
	}

	join(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["JOIN", stmt]);
	}

	innerJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["INNER JOIN", stmt]);
	}

	leftJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["LEFT JOIN", stmt]);
	}

	rightJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["RIGHT JOIN", stmt]);
	}

	fullJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["FULL OUTER JOIN", stmt]);
	}

	crossJoin(table: string): this {
		return this.#derive("pushJoin", ["CROSS JOIN", { sqlFragments: [table] }]);
	}

	select(...columns: string[]): this {
		return this.#derive("setSelect", [columns]);
	}

	addSelect(...columns: string[]): this {
		return this.#derive("pushSelect", [columns]);
	}

	replaceSelect(...columns: string[]): this {
		return this.#derive("setSelect", [columns]);
	}

	where(conditionOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(conditionOrStatement, values);
		return this.#derive("pushWhere", [stmt]);
	}

	groupBy(...columns: string[]): this {
		return this.#derive("pushGroupBy", [columns]);
	}

	having(conditionOrStatement: string | Statement, ...values: unknown[]): this {
		const stmt = resolveToStatement(conditionOrStatement, values);
		return this.#derive("pushHaving", [stmt]);
	}

	orderBy(...columns: string[]): this {
		return this.#derive("pushOrderBy", [columns]);
	}

	replaceOrderBy(...columns: string[]): this {
		return this.#derive("setOrderBy", [columns]);
	}

	limit(n: number): this {
		return this.#derive("setLimit", [n]);
	}

	offset(n: number): this {
		return this.#derive("setOffset", [n]);
	}

	distinct(): this {
		return this.#derive("setDistinct", []);
	}

	forUpdate(options?: LockOptions): this {
		return this.#derive("setLock", ["UPDATE", options]);
	}

	forShare(options?: LockOptions): this {
		return this.#derive("setLock", ["SHARE", options]);
	}

	insert(_values: Record<string, unknown> | Record<string, unknown>[] | Statement): this {
		throw new Error("insert() not yet implemented");
	}

	deleteAll(): Promise<MutationResult> {
		throw new Error("deleteAll() not yet implemented");
	}

	updateAll(_values: Record<string, unknown>): Promise<MutationResult> {
		throw new Error("updateAll() not yet implemented");
	}

	returning<T extends string>(..._columns: T[]): Promise<Record<T, unknown>[]> {
		throw new Error("returning() not yet implemented");
	}

	returningId<T = number>(_column?: string): Promise<T[]> {
		throw new Error("returningId() not yet implemented");
	}

	// oxlint-disable-next-line unicorn/no-thenable -- intentionally awaitable API
	then: Promise<MutationResult>["then"] = () => {
		throw new Error("then() not yet implemented");
	};

	static table(table: string, grammar: DatabaseGrammar): QueryBuilder {
		return new QueryBuilderImpl({ sqlFragments: [table] }, grammar, []);
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
		return splitSqlToFragments(conditionOrStatement, values);
	}
	// It's already a Statement which extends SqlFragments
	return conditionOrStatement;
}
