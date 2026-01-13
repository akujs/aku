import { arrayWrap } from "../../utils.ts";
import type { DatabaseClient } from "../DatabaseClient.ts";
import { ExecutableStatementBase } from "../ExecutableStatementBase.ts";
import type { DatabaseGrammar } from "../grammar/DatabaseGrammar.ts";
import type {
	AnyQueryBuilder,
	ConflictOptions,
	DistinctOptions,
	InsertOptions,
	QueryBuilder,
	QueryParts,
	Row,
	RowLockOptions,
	SqlFragments,
	Statement,
	StringOrFragment,
	UpdateFromOptions,
} from "../query-types.ts";
import { MutableQueryBuilder } from "./MutableQueryBuilder.ts";
import { toHumanReadableSql } from "./statement-render.ts";
import { isSqlFragments, splitSqlToFragments } from "./statement-utils.ts";

export class QueryBuilderImpl extends ExecutableStatementBase implements AnyQueryBuilder {
	readonly #grammar: DatabaseGrammar;
	readonly #client: DatabaseClient;
	readonly #commands: Command[];
	readonly #length: number;
	#cachedParts: QueryParts | null = null;
	#cachedBuild: SqlFragments | null = null;

	constructor(grammar: DatabaseGrammar, client: DatabaseClient, commands: Command[]) {
		super([]); // We override sqlFragments getter, so this is unused
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

	join(clauseOrStatement: string | Statement, ...values: unknown[]): QueryBuilderImpl {
		assertNoUndefinedValues(clauseOrStatement, values, "join");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["JOIN", stmt]);
	}

	innerJoin(clauseOrStatement: string | Statement, ...values: unknown[]): QueryBuilderImpl {
		assertNoUndefinedValues(clauseOrStatement, values, "innerJoin");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["INNER JOIN", stmt]);
	}

	leftJoin(clauseOrStatement: string | Statement, ...values: unknown[]): QueryBuilderImpl {
		assertNoUndefinedValues(clauseOrStatement, values, "leftJoin");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["LEFT JOIN", stmt]);
	}

	rightJoin(clauseOrStatement: string | Statement, ...values: unknown[]): QueryBuilderImpl {
		assertNoUndefinedValues(clauseOrStatement, values, "rightJoin");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["RIGHT JOIN", stmt]);
	}

	fullJoin(clauseOrStatement: string | Statement, ...values: unknown[]): QueryBuilderImpl {
		assertNoUndefinedValues(clauseOrStatement, values, "fullJoin");
		const stmt = resolveToStatement(clauseOrStatement, values);
		return this.#derive("pushJoin", ["FULL OUTER JOIN", stmt]);
	}

	crossJoin(table: string): QueryBuilderImpl {
		return this.#derive("pushJoin", ["CROSS JOIN", { sqlFragments: [table] }]);
	}

	select(...columns: string[]): QueryBuilderImpl {
		return this.#derive("setSelect", [columns]);
	}

	addSelect(...columns: string[]): QueryBuilderImpl {
		return this.#derive("pushSelect", [columns]);
	}

	replaceSelect(...columns: string[]): QueryBuilderImpl {
		return this.#derive("setSelect", [columns]);
	}

	where(conditionOrStatement: string | Statement, ...values: unknown[]): QueryBuilderImpl {
		assertNoUndefinedValues(conditionOrStatement, values, "where");
		const stmt = resolveToStatement(conditionOrStatement, values);
		return this.#derive("pushWhere", [stmt]);
	}

	whereId(id: unknown): QueryBuilderImpl {
		return this.where("id = ?", id);
	}

	groupBy(...columns: string[]): QueryBuilderImpl {
		return this.#derive("pushGroupBy", [columns]);
	}

	having(conditionOrStatement: string | Statement, ...values: unknown[]): QueryBuilderImpl {
		assertNoUndefinedValues(conditionOrStatement, values, "having");
		const stmt = resolveToStatement(conditionOrStatement, values);
		return this.#derive("pushHaving", [stmt]);
	}

	orderBy(...columns: string[]): QueryBuilderImpl {
		return this.#derive("setOrderBy", [columns]);
	}

	addOrderBy(...columns: string[]): QueryBuilderImpl {
		return this.#derive("pushOrderBy", [columns]);
	}

	replaceOrderBy(...columns: string[]): QueryBuilderImpl {
		return this.#derive("setOrderBy", [columns]);
	}

	limit(n: number): QueryBuilderImpl {
		return this.#derive("setLimit", [n]);
	}

	offset(n: number): QueryBuilderImpl {
		return this.#derive("setOffset", [n]);
	}

	distinct(options?: DistinctOptions): QueryBuilderImpl {
		return this.#derive("setDistinct", [options ?? {}]);
	}

	inRandomOrder(): QueryBuilderImpl {
		return this.addOrderBy("RANDOM()");
	}

	withRowLock(options?: RowLockOptions): QueryBuilderImpl {
		return this.#derive("setLock", [
			{
				mode: options?.mode ?? "update",
				onLocked: options?.onLocked ?? "wait",
			},
		]);
	}

	withPrepare(value = true): QueryBuilderImpl {
		return this.#derive("setPrepare", [value]);
	}

	insert<V extends Row | Row[] | Statement>(
		values: V,
		options?: InsertOptions,
	): V extends unknown[]
		? // oddly, this is necessary to get the type checker to allow this as an impl of AnyQueryBuilder
			QueryBuilderImpl
		: QueryBuilderImpl {
		assertNoUndefinedValues(values, "insert");
		return this.#derive("setInsert", [{ data: values, columns: options?.columns ?? null }]);
	}

	onConflict(options: ConflictOptions): QueryBuilderImpl {
		const option = "on";
		if (arrayWrap(options[option]).length === 0) {
			throw new Error(`At least one '${option}' is required to onConflict({${option}: ...})`);
		}
		return this.#derive("setConflict", [options]);
	}

	deleteAll(): QueryBuilderImpl {
		return this.#derive("setDeleteAll", []);
	}

	updateAll(values: Row): QueryBuilderImpl {
		assertNoUndefinedValues(values, "updateAll");
		return this.#derive("setUpdateAll", [values]);
	}

	updateFrom(source: Row | Row[], options?: UpdateFromOptions): QueryBuilderImpl {
		const rows = arrayWrap(source);
		if (rows.length === 0) {
			throw new Error("updateFrom requires at least one row");
		}
		assertNoUndefinedValues(rows, "updateFrom");

		const on = options?.on ?? "id";
		const updateColumns = options?.updateColumns ?? Object.keys(rows[0]);

		if (!updateColumns.includes(on)) {
			throw new Error(
				`updateFrom: the 'on' column '${on}' must be present in the update columns: ${updateColumns.join(", ")}`,
			);
		}

		return this.#derive("setUpdateFrom", [{ data: rows, on, updateColumns }]);
	}

	returning(...columns: string[]): QueryBuilderImpl {
		return this.#derive("setReturning", [columns]);
	}

	returningId(): QueryBuilderImpl {
		return this.#derive("setReturning", [["id"]]);
	}

	runAndReturn(...columns: string[]): Promise<Row | Row[]> {
		const builder = this.returning(...columns);
		if (this.#isSingleRowInsert()) {
			return builder.getFirstOrFail();
		}
		return builder.getAll();
	}

	runAndReturnId(): Promise<unknown> {
		const builder = this.returningId();
		if (this.#isSingleRowInsert()) {
			return builder.getScalar();
		}
		return builder.getColumn();
	}

	getByIdOrFail(id: unknown): Promise<Row> {
		return this.whereId(id).getFirstOrFail();
	}

	getByIdOrNotFound(id: unknown): Promise<Row> {
		return this.whereId(id).getFirstOrNotFound();
	}

	getByIdOrNull(id: unknown): Promise<Row | null> {
		return this.whereId(id).getFirstOrNull();
	}

	getCount(column = "*"): Promise<number> {
		return this.select(`COUNT(${column})`).getScalar();
	}

	getMin(column: string): Promise<number | null> {
		return this.select(`MIN(${column})`).getScalar();
	}

	getMax(column: string): Promise<number | null> {
		return this.select(`MAX(${column})`).getScalar();
	}

	getAvg(column: string): Promise<number | null> {
		return this.select(`AVG(${column})`).getScalar();
	}

	getSum(column: string): Promise<number | null> {
		return this.select(`SUM(${column})`).getScalar();
	}

	getExists(): Promise<boolean> {
		return this.#derive("setExists", []).getScalar().then(Boolean);
	}

	union(other: Statement): QueryBuilderImpl {
		if (this.#getParts().unionMembers) {
			return this.#derive("pushUnionMember", ["UNION", other]);
		}
		const commands: Command[] = [
			["pushUnionMember", [null, this]],
			["pushUnionMember", ["UNION", other]],
		];
		return new QueryBuilderImpl(this.#grammar, this.#client, commands);
	}

	unionAll(other: Statement): QueryBuilderImpl {
		if (this.#getParts().unionMembers) {
			return this.#derive("pushUnionMember", ["UNION ALL", other]);
		}
		const commands: Command[] = [
			["pushUnionMember", [null, this]],
			["pushUnionMember", ["UNION ALL", other]],
		];
		return new QueryBuilderImpl(this.#grammar, this.#client, commands);
	}

	static table(table: string, grammar: DatabaseGrammar, client: DatabaseClient): QueryBuilder {
		return new QueryBuilderImpl(grammar, client, [["setTable", [table]]]) as QueryBuilder;
	}

	#isSingleRowInsert(): boolean {
		const insert = this.#getParts().insert;
		return insert !== null && !Array.isArray(insert.data) && !isSqlFragments(insert.data);
	}

	#derive<K extends MutableQueryBuilderMethod>(
		method: K,
		args: Parameters<MutableQueryBuilder[K]>,
	): QueryBuilderImpl {
		let commands = this.#commands;

		if (commands.length > this.#length) {
			// We've already derived from this builder, we need to clone the array
			commands = commands.slice(0, this.#length);
		}

		commands.push([method, args]);
		return new QueryBuilderImpl(this.#grammar, this.#client, commands);
	}

	#getParts(): QueryParts {
		if (!this.#cachedParts) {
			const builder = new MutableQueryBuilder();
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

type MutableQueryBuilderMethod = {
	[K in keyof MutableQueryBuilder]: MutableQueryBuilder[K] extends (...args: never[]) => unknown
		? K
		: never;
}[keyof MutableQueryBuilder];

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
