import { arrayWrap } from "../../utils.ts";
import type { DatabaseClient } from "../DatabaseClient.ts";
import { ExecutableStatementBase } from "../ExecutableStatementBase.ts";
import type { DatabaseGrammar } from "../grammar/DatabaseGrammar.ts";
import type {
	AnyQueryBuilder,
	ExecutableStatement,
	InsertOptions,
	QueryBuilder,
	QueryParts,
	Row,
	RowLockOptions,
	SqlFragments,
	Statement,
	StringOrFragment,
	ThenExecutor,
} from "../query-types.ts";
import { MutableQueryBuilder } from "./MutableQueryBuilder.ts";
import { toHumanReadableSql } from "./statement-render.ts";
import { isSqlFragments, splitSqlToFragments } from "./statement-utils.ts";

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

	override get prepare(): boolean | undefined {
		return this.#getParts().prepare ?? undefined;
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
		assertNoUndefinedValues(clauseOrStatement, values, "join");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["JOIN", stmt]);
	}

	innerJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		assertNoUndefinedValues(clauseOrStatement, values, "innerJoin");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["INNER JOIN", stmt]);
	}

	leftJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		assertNoUndefinedValues(clauseOrStatement, values, "leftJoin");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["LEFT JOIN", stmt]);
	}

	rightJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		assertNoUndefinedValues(clauseOrStatement, values, "rightJoin");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["RIGHT JOIN", stmt]);
	}

	fullJoin(clauseOrStatement: string | Statement, ...values: unknown[]): this {
		assertNoUndefinedValues(clauseOrStatement, values, "fullJoin");
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
		assertNoUndefinedValues(conditionOrStatement, values, "where");
		const stmt = resolveToStatement(conditionOrStatement, values);
		return this.#derive("pushWhere", [stmt]);
	}

	groupBy(...columns: string[]): this {
		return this.#derive("pushGroupBy", [columns]);
	}

	having(conditionOrStatement: string | Statement, ...values: unknown[]): this {
		assertNoUndefinedValues(conditionOrStatement, values, "having");
		const stmt = resolveToStatement(conditionOrStatement, values);
		return this.#derive("pushHaving", [stmt]);
	}

	orderBy(...columns: string[]): this {
		return this.#derive("setOrderBy", [columns]);
	}

	addOrderBy(...columns: string[]): this {
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

	withRowLock(options?: RowLockOptions): this {
		return this.#derive("setLock", [
			{
				mode: options?.mode ?? "update",
				onLocked: options?.onLocked ?? "wait",
			},
		]);
	}

	withPrepare(value = true): this {
		return this.#derive("setPrepare", [value]);
	}

	insert(values: Row | Row[] | Statement, options?: InsertOptions): this {
		assertNoUndefinedValues(values, "insert");
		return this.#derive("setInsert", [{ data: values, columns: options?.columns ?? null }], "run");
	}

	deleteAll(): this {
		return this.#derive("setDelete", [], "run");
	}

	updateAll(values: Row): this {
		assertNoUndefinedValues(values, "updateAll");
		return this.#derive("setUpdateData", [values], "run");
	}

	returning(...columns: string[]): ExecutableStatement<unknown> {
		const executor = this.#isSingleRowInsert() ? "first" : "all";
		return this.#derive("setReturning", [columns], executor) as ExecutableStatement<unknown>;
	}

	returningId(): ExecutableStatement<unknown> {
		const executor = this.#isSingleRowInsert() ? "scalar" : "column";
		return this.#derive("setReturning", [["id"]], executor) as ExecutableStatement<unknown>;
	}

	// oxlint-disable-next-line unicorn/no-thenable -- intentionally awaitable API
	then: Promise<unknown>["then"] = (onfulfilled, onrejected) => {
		const executor = this.#getParts().thenExecutor ?? "all";
		if (this.#isEmptyArrayInsert()) {
			const emptyResult = executor === "run" ? { rowsAffected: 0 } : [];
			return Promise.resolve(emptyResult).then(onfulfilled, onrejected);
		}
		return this[executor]().then(onfulfilled, onrejected);
	};

	static table(table: string, grammar: DatabaseGrammar, client: DatabaseClient): QueryBuilder {
		return new QueryBuilderImpl(table, grammar, client, []) as QueryBuilder;
	}

	#isEmptyArrayInsert(): boolean {
		const insert = this.#getParts().insert;
		return insert !== null && Array.isArray(insert.data) && insert.data.length === 0;
	}

	#isSingleRowInsert(): boolean {
		const insert = this.#getParts().insert;
		return insert !== null && !Array.isArray(insert.data) && !isSqlFragments(insert.data);
	}

	#derive<K extends MutableQueryBuilderMethod>(
		method: K,
		args: Parameters<MutableQueryBuilder[K]>,
		thenExecutor?: ThenExecutor,
	): this {
		let commands = this.#commands;

		if (commands.length > this.#length) {
			// We've already derived from this builder, we need to clone the array
			commands = commands.slice(0, this.#length);
		}

		commands.push([method, args]);
		if (thenExecutor) {
			commands.push(["setThenExecutor", [thenExecutor]]);
		}
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
	| "setInsert"
	| "setUpdateData"
	| "setDelete"
	| "setReturning"
	| "setThenExecutor"
	| "setPrepare";

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

function assertNoUndefinedValues(
	firstArg: string | Statement | Row | Row[],
	secondArg: unknown[] | string,
	thirdArg?: string,
): void {
	// Skip validation for Statements (values will be empty anyway)
	if (isSqlFragments(firstArg)) {
		return;
	}

	// Row/Row[] mode: assertNoUndefinedValues(rowOrRows, methodName)
	if (typeof secondArg === "string") {
		const methodName = secondArg;
		for (const row of arrayWrap(firstArg as Row | Row[])) {
			for (const [key, value] of Object.entries(row)) {
				if (value === undefined) {
					throw new Error(
						`Cannot pass undefined for property '${key}' to ${methodName}(...). Use null for NULL values.`,
					);
				}
			}
		}
		return;
	}

	// Placeholder mode: assertNoUndefinedValues(sql, values, methodName)
	const sql = firstArg as string;
	const values = secondArg;
	const methodName = thirdArg!;
	for (let i = 0; i < values.length; i++) {
		if (values[i] === undefined) {
			throw new Error(
				`Cannot pass undefined for parameter ${i + 1} in ${methodName}('${sql}', ...). Use null for NULL values.`,
			);
		}
	}
}
