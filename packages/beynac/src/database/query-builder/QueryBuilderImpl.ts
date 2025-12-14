import { BaseClass } from "../../utils.ts";
import type { SqlFragments, Statement } from "../Statement.ts";
import { MutableQueryBuilder } from "./MutableQueryBuilder.ts";
import type { LockOptions, QueryBuilder, SelectNotSetQueryBuilder } from "./QueryBuilder.ts";
import { renderForLogs, renderSql } from "./statement-render.ts";

export class QueryBuilderImpl extends BaseClass implements Statement {
	readonly #from: string;
	readonly #commands: Command[];
	readonly #length: number;
	#cachedBuild: { fragments: readonly string[]; params: unknown[] } | null = null;

	constructor(from: string, commands: Command[]) {
		super();
		this.#from = from;
		this.#commands = commands;
		this.#length = commands.length;
	}

	get fragments(): readonly string[] {
		return this.#getBuild().fragments;
	}

	get params(): unknown[] {
		return this.#getBuild().params;
	}

	renderSql(renderPlaceholder: (index: number) => string): string {
		return renderSql(this.#getBuild(), renderPlaceholder);
	}

	renderForLogs(): string {
		return renderForLogs(this.#getBuild());
	}

	join(clause: string): this {
		return this.#derive("pushJoin", ["JOIN", clause]);
	}

	innerJoin(clause: string): this {
		return this.#derive("pushJoin", ["INNER JOIN", clause]);
	}

	leftJoin(clause: string): this {
		return this.#derive("pushJoin", ["LEFT JOIN", clause]);
	}

	rightJoin(clause: string): this {
		return this.#derive("pushJoin", ["RIGHT JOIN", clause]);
	}

	fullJoin(clause: string): this {
		return this.#derive("pushJoin", ["FULL OUTER JOIN", clause]);
	}

	crossJoin(table: string): this {
		return this.#derive("pushJoin", ["CROSS JOIN", table]);
	}

	select(...columns: string[]): QueryBuilder {
		return this.#derive("setSelect", [columns]) as unknown as QueryBuilder;
	}

	addSelect(...columns: string[]): this {
		return this.#derive("pushSelect", [columns]);
	}

	replaceSelect(...columns: string[]): this {
		return this.#derive("setSelect", [columns]);
	}

	where(condition: string): this {
		return this.#derive("pushWhere", [condition]);
	}

	groupBy(...columns: string[]): this {
		return this.#derive("pushGroupBy", [columns]);
	}

	having(condition: string): this {
		return this.#derive("pushHaving", [condition]);
	}

	// Fluent methods - Ordering
	orderBy(...columns: string[]): this {
		return this.#derive("pushOrderBy", [columns]);
	}

	replaceOrderBy(...columns: string[]): this {
		return this.#derive("setOrderBy", [columns]);
	}

	// Fluent methods - Pagination
	limit(n: number): this {
		return this.#derive("setLimit", [n]);
	}

	offset(n: number): this {
		return this.#derive("setOffset", [n]);
	}

	// Fluent methods - Modifiers
	distinct(): this {
		return this.#derive("setDistinct", []);
	}

	forUpdate(options?: LockOptions): this {
		return this.#derive("setLock", ["UPDATE", options]);
	}

	forShare(options?: LockOptions): this {
		return this.#derive("setLock", ["SHARE", options]);
	}

	static from(table: string): SelectNotSetQueryBuilder {
		return new QueryBuilderImpl(table, []) as SelectNotSetQueryBuilder;
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
		return new QueryBuilderImpl(this.#from, commands) as this;
	}

	#getBuild(): SqlFragments {
		if (!this.#cachedBuild) {
			const builder = new MutableQueryBuilder(this.#from);
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
