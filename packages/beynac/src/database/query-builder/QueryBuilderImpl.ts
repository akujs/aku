import type { DatabaseClient } from "../DatabaseClient.ts";
import { ExecutableStatementBase } from "../ExecutableStatementBase.ts";
import type { DatabaseGrammar } from "../grammar/DatabaseGrammar.ts";
import type {
	AnyQueryBuilder,
	LockOptions,
	MutationResult,
	QueryBuilder,
	QueryParts,
	SqlFragments,
	Statement,
	StringOrFragment,
} from "../query-types.ts";
import { MutableQueryBuilder } from "./MutableQueryBuilder.ts";
import { toHumanReadableSql } from "./statement-render.ts";
import { splitSqlToFragments } from "./statement-utils.ts";

export class QueryBuilderImpl extends ExecutableStatementBase implements AnyQueryBuilder {
	readonly #from: string;
	readonly #grammar: DatabaseGrammar;
	readonly #client: DatabaseClient;
	readonly #commands: Command[];
	readonly #length: number;
	#cachedParts: QueryParts | null = null;
	#cachedBuild: SqlFragments | null = null;

	constructor(from: string, grammar: DatabaseGrammar, client: DatabaseClient, commands: Command[]) {
		super([]); // We override sqlFragments getter, so this is unused
		this.#from = from;
		this.#grammar = grammar;
		this.#client = client;
		this.#commands = commands;
		this.#length = commands.length;
	}

	protected getClient(): DatabaseClient {
		return this.#client;
	}

	override get sqlFragments(): readonly StringOrFragment[] {
		return this.#getBuild().sqlFragments;
	}

	override toHumanReadableSql(): string {
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

	insert(values: Record<string, unknown> | Record<string, unknown>[] | Statement): this {
		// Check if it's a Statement (INSERT...SELECT)
		if ("sqlFragments" in values) {
			// TODO: Implement INSERT...SELECT
			throw new Error("INSERT...SELECT not yet implemented");
		}
		const data = Array.isArray(values) ? values : [values];
		return this.#derive("setInsertData", [data]);
	}

	deleteAll(): Promise<MutationResult> {
		const derived = this.#derive("setDelete", []);
		return derived.run().then((r) => ({ rowsAffected: r.rowsAffected }));
	}

	updateAll(values: Record<string, unknown>): Promise<MutationResult> {
		const derived = this.#derive("setUpdateData", [values]);
		return derived.run().then((r) => ({ rowsAffected: r.rowsAffected }));
	}

	async returning<T extends string>(..._columns: T[]): Promise<Record<T, unknown>[]> {
		if (this.#isEmptyArrayInsert()) {
			return [];
		}
		// TODO: Implement RETURNING clause compilation
		throw new Error("returning() not yet implemented");
	}

	async returningId<T = number>(_column?: string): Promise<T[]> {
		if (this.#isEmptyArrayInsert()) {
			return [];
		}
		// TODO: Implement RETURNING id clause compilation
		throw new Error("returningId() not yet implemented");
	}

	// oxlint-disable-next-line unicorn/no-thenable -- intentionally awaitable API
	then: Promise<MutationResult>["then"] = (onfulfilled, onrejected) => {
		if (this.#isEmptyArrayInsert()) {
			return Promise.resolve({ rowsAffected: 0 }).then(onfulfilled, onrejected);
		}
		return this.run()
			.then((r) => ({ rowsAffected: r.rowsAffected }))
			.then(onfulfilled, onrejected);
	};

	static table(table: string, grammar: DatabaseGrammar, client: DatabaseClient): QueryBuilder {
		return new QueryBuilderImpl(table, grammar, client, []);
	}

	#isEmptyArrayInsert(): boolean {
		return this.#getParts().insertData?.length === 0;
	}

	#derive<K extends MutableQueryBuilderMethod>(
		method: K,
		args: Parameters<MutableQueryBuilder[K]>,
	): this {
		let commands = this.#commands;

		if (commands.length > this.#length) {
			// We've already derived from this builder, we need to clone the array
			commands = commands.slice(0, this.#length);
		}

		commands.push([method, args]);
		return new QueryBuilderImpl(this.#from, this.#grammar, this.#client, commands) as this;
	}

	#getParts(): QueryParts {
		if (!this.#cachedParts) {
			const builder = new MutableQueryBuilder(this.#from);
			for (let i = 0; i < this.#length; i++) {
				const [method, args] = this.#commands[i];
				(builder[method] as (...a: unknown[]) => void)(...args);
			}
			this.#cachedParts = builder;
		}
		return this.#cachedParts;
	}

	#getBuild(): SqlFragments {
		if (!this.#cachedBuild) {
			this.#cachedBuild = this.#grammar.compileQuery(this.#getParts());
		}
		return this.#cachedBuild;
	}
}

// Method names on MutableQueryBuilder that can be called via #derive
type MutableQueryBuilderMethod =
	| "pushJoin"
	| "setSelect"
	| "pushSelect"
	| "pushWhere"
	| "pushGroupBy"
	| "pushHaving"
	| "pushOrderBy"
	| "setOrderBy"
	| "setLimit"
	| "setOffset"
	| "setDistinct"
	| "setLock"
	| "setInsertData"
	| "setUpdateData"
	| "setDelete";

type Command = [MutableQueryBuilderMethod, unknown[]];

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
