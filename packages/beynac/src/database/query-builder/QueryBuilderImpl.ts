import { BaseClass } from "../../utils.ts";
import type { Statement } from "../Statement.ts";
import { MutableQueryBuilder } from "./MutableQueryBuilder.ts";
import type { QueryBuilder, SelectNotSetQueryBuilder } from "./QueryBuilder.ts";
import { renderForLogs, renderSql } from "./statement-render.ts";

// Derive command types from MutableQueryBuilder's method signatures
type BuilderMethod = keyof {
	[K in keyof MutableQueryBuilder as MutableQueryBuilder[K] extends (...args: never[]) => void
		? K
		: never]: true;
};
type BuilderArgs<K extends BuilderMethod> = Parameters<MutableQueryBuilder[K]>;
type QueryCommand = { [K in BuilderMethod]: [K, BuilderArgs<K>] }[BuilderMethod];

function cmd<K extends BuilderMethod>(method: K, args: BuilderArgs<K>): QueryCommand {
	return [method, args] as QueryCommand;
}

export class QueryBuilderImpl extends BaseClass implements Statement {
	readonly #from: string;
	readonly #commands: QueryCommand[];
	readonly #length: number;
	#cachedBuild: { fragments: readonly string[]; params: unknown[] } | null = null;

	constructor(from: string, commands: QueryCommand[]) {
		super();
		this.#from = from;
		this.#commands = commands;
		this.#length = commands.length;
	}

	#derive<K extends BuilderMethod>(method: K, args: BuilderArgs<K>): this {
		let commands = this.#commands;

		if (commands.length > this.#length) {
			// We've already derived from this builder, we need to clone the array
			commands = commands.slice(0, this.#length);
		}

		commands.push(cmd(method, args));
		return new QueryBuilderImpl(this.#from, commands) as this;
	}

	#getBuild(): { fragments: readonly string[]; params: unknown[] } {
		if (!this.#cachedBuild) {
			this.#cachedBuild = this.#build();
		}
		return this.#cachedBuild;
	}

	#build(): { fragments: readonly string[]; params: unknown[] } {
		const builder = new MutableQueryBuilder(this.#from);
		for (let i = 0; i < this.#length; i++) {
			const [method, args] = this.#commands[i];
			(builder[method] as (...a: unknown[]) => void)(...args);
		}
		return builder.compile();
	}

	// Statement interface
	get fragments(): readonly string[] {
		return this.#getBuild().fragments;
	}

	get params(): unknown[] {
		return this.#getBuild().params;
	}

	renderSql(renderPlaceholder: (index: number) => string): string {
		const { fragments, params } = this.#getBuild();
		return renderSql(fragments, params, renderPlaceholder);
	}

	renderForLogs(): string {
		const { fragments, params } = this.#getBuild();
		return renderForLogs(fragments, params);
	}

	// Fluent methods - Joins
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

	// Fluent methods - Select
	select(...columns: string[]): QueryBuilder {
		return this.#derive("setSelect", [columns]) as unknown as QueryBuilder;
	}

	addSelect(...columns: string[]): this {
		return this.#derive("pushSelect", [columns]);
	}

	replaceSelect(...columns: string[]): this {
		return this.#derive("setSelect", [columns]);
	}

	// Fluent methods - WHERE
	where(condition: string): this {
		return this.#derive("pushWhere", [condition]);
	}

	// Fluent methods - Grouping
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

	forUpdate(option?: string): this {
		return this.#derive("setLock", ["UPDATE", option]);
	}

	forShare(): this {
		return this.#derive("setLock", ["SHARE", undefined]);
	}

	static from(table: string): SelectNotSetQueryBuilder {
		return new QueryBuilderImpl(table, []) as SelectNotSetQueryBuilder;
	}
}
