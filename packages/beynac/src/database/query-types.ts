export interface SqlFragment {
	sql: string;
	param: unknown;
}

export type StringOrFragment = string | SqlFragment;

export interface SqlFragments {
	get sqlFragments(): readonly StringOrFragment[];
}

export interface RowLockOptions {
	mode?: "update" | "share" | undefined;
	onLocked?: "wait" | "fail" | "skip" | undefined;
}

export type JoinType =
	| "JOIN"
	| "INNER JOIN"
	| "LEFT JOIN"
	| "RIGHT JOIN"
	| "FULL OUTER JOIN"
	| "CROSS JOIN";

export interface JoinEntry {
	type: JoinType;
	clause: SqlFragments;
}

export interface InsertOptions {
	columns?: string[] | undefined;
}

export interface InsertPart {
	data: Row | Row[] | SqlFragments;
	columns: readonly string[] | null;
}

export interface LockPart {
	mode: "update" | "share";
	onLocked: "wait" | "fail" | "skip";
}

export type ThenExecutor =
	| "run"
	| "all"
	| "column"
	| "scalar"
	| "firstOrFail"
	| "firstOrNotFound"
	| "firstOrNull";

export interface ConflictOptions {
	/**
	 * Column(s) that define the unique constraint
	 */
	on: string | string[];

	/**
	 * `ignore` skips conflicting rows, `update` updates them
	 */
	do: "update" | "ignore";

	/**
	 * Columns to update on conflict, if do: "update" is specified. Defaults to
	 * all insert columns except the `on` columns.
	 */
	updateColumns?: string[] | undefined;
}

export interface UpdateFromOptions {
	/**
	 * Column to match rows on. Defaults to "id".
	 */
	on?: string | undefined;

	/**
	 * Columns to include in the update. Defaults to all columns from the first
	 * row. Use this to select a subset of properties when source objects contain
	 * extra fields.
	 */
	updateColumns?: string[] | undefined;
}

export interface UpdateFromPart {
	data: Row[];
	on: string;
	updateColumns: string[];
}

export interface QueryParts {
	readonly table: string;
	readonly joins: readonly JoinEntry[];
	readonly select: readonly string[];
	readonly where: readonly SqlFragments[];
	readonly groupBy: readonly string[];
	readonly having: readonly SqlFragments[];
	readonly orderBy: readonly string[];
	readonly limit: number | null;
	readonly offset: number | null;
	readonly distinct: boolean;
	readonly lock: LockPart | null;
	readonly insert: InsertPart | null;
	readonly conflict: ConflictOptions | null;
	readonly updateData: Row | null;
	readonly updateFrom: UpdateFromPart | null;
	readonly isDelete: boolean;
	readonly returningColumns: readonly string[] | null;
	readonly thenExecutor: ThenExecutor | null;
	readonly prepare: boolean | null;
}

export interface Statement extends SqlFragments {
	/**
	 * Render this statement for logging, with parameter values inlined.
	 */
	toHumanReadableSql(): string;

	/**
	 * Optionally override the default behavior of whether to use prepared statements
	 */
	readonly prepare?: boolean | undefined;
}

export interface StatementResult {
	rows: Row[];
	rowsAffected: number;
}

export type Row = Record<string, unknown>;

/**
 * A SQL statement with an associated database client that can be executed
 * directly by awaiting or calling execution methods like `.all()`.
 */
export interface ExecutableStatement<TThen = Row[]>
	extends Statement,
		StatementExecutionMethods<TThen> {}

/**
 * A SQL statement with no associated database client. Executing it by awaiting
 * awaiting or calling execution methods like `.all()` will use the default
 * database client.
 */
export interface ExecutableStatementWithoutClient extends Statement, StatementExecutionMethods {
	/**
	 * Specify which database client to use.
	 */
	on(clientName: string): ExecutableStatement;
}

interface StatementExecutionMethods<TThen = Row[]> {
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
	 * This `then` method allows awaiting the statement directly.
	 *
	 * @example
	 * const allRows = await sql`SELECT * FROM users`;
	 */
	then: Promise<TThen>["then"];

	/**
	 * Override the default behavior of whether to use prepared statements.
	 *
	 * This only has an effect on adapters that support prepared statements -
	 * currently only the Postgres adapter.
	 *
	 * @param value - Whether to use prepared statements. Defaults to `true`.
	 */
	withPrepare(value?: boolean): this;
}

type ByIdExecutionMethods<T> = Pick<
	StatementExecutionMethods<T>,
	"run" | "scalar" | "then" | "withPrepare"
>;

type MutationExecutionMethods = Pick<
	StatementExecutionMethods<StatementResult>,
	"run" | "then" | "withPrepare"
>;

type ReturningExecutionMethods<T> = Pick<
	StatementExecutionMethods<T>,
	"run" | "all" | "scalar" | "column" | "then" | "withPrepare"
>;

/**
 * An interface with all query builder methods. Normally you will be working
 * with one of the more specific builder types but this can be used when you
 * need to accept any kind of builder.
 *
 * Note that this does not have the type protections of the more specific
 * builder types, so you can make nonsensical call combinations, such as
 * `builder.offset(10).updateAll({foo: "bar"})` (offset only applies to select
 * queries and is ignored by update queries).
 */
export interface AnyQueryBuilder
	extends Statement,
		StatementExecutionMethods<unknown>,
		BulkMutationMethods<AnyQueryBuilder>,
		InsertMethod<AnyQueryBuilder>,
		ReturningMethods<unknown, unknown>,
		WhereMethod<AnyQueryBuilder>,
		SelectSetInitialColumns<AnyQueryBuilder>,
		OrderBySetInitial<AnyQueryBuilder>,
		SelectClauseMethods<AnyQueryBuilder> {}

/**
 * A query builder in its initial state, as returned by db.table()
 */
export interface QueryBuilder
	extends Statement,
		StatementExecutionMethods,
		ByIdMethods,
		InsertMethod<QueryBuilderWithInsertSingle, QueryBuilderWithInsertArray>,
		BulkMutationMethods,
		WhereMethod<QueryBuilderWithCondition>,
		SelectSetInitialColumns<SelectQueryBuilder<true, false>>,
		OrderBySetInitial<SelectQueryBuilder<false, true>>,
		SelectClauseMethods<SelectQueryBuilder<false, false>> {}

/**
 * Query builder after where() has been called. Permits bulk updates / deletes
 * and selects, but not inserts.
 */
export interface QueryBuilderWithCondition
	extends Statement,
		StatementExecutionMethods,
		BulkMutationMethods,
		WhereMethod<QueryBuilderWithCondition>,
		SelectSetInitialColumns<SelectQueryBuilder<true, false>>,
		OrderBySetInitial<SelectQueryBuilder<false, true>>,
		SelectClauseMethods<SelectQueryBuilder<false, false>> {}

export type SelectQueryBuilder<
	TSelect extends boolean = false,
	TOrderBy extends boolean = false,
> = Statement &
	StatementExecutionMethods &
	WhereMethod<SelectQueryBuilder<TSelect, TOrderBy>> &
	SelectClauseMethods<SelectQueryBuilder<TSelect, TOrderBy>> &
	(TSelect extends true
		? SelectModifyColumns<SelectQueryBuilder<true, TOrderBy>>
		: SelectSetInitialColumns<SelectQueryBuilder<true, TOrderBy>>) &
	(TOrderBy extends true
		? OrderByModify<SelectQueryBuilder<TSelect, true>>
		: OrderBySetInitial<SelectQueryBuilder<TSelect, true>>);

/**
 * Query builder for mutation statements (INSERT, UPDATE, DELETE)
 */
export interface QueryBuilderWithMutation extends Statement, MutationExecutionMethods {}

/**
 * Query builder for INSERT statements. Extends mutation with RETURNING support.
 */
export interface QueryBuilderWithInsert<TReturning, TReturningId>
	extends QueryBuilderWithMutation,
		ReturningMethods<TReturning, TReturningId> {
	/**
	 * Handle conflicts when inserting rows that violate unique constraints.
	 *
	 * @param options.on - Column(s) that define the unique constraint
	 * @param options.do - `ignore` skips conflicting rows, `update` updates them
	 * @param options.updateColumns - Columns to update on conflict. Defaults to
	 *   all insert columns except the conflict columns.
	 *
	 * @example
	 * // Ignore conflicts
	 * table("users").insert({ email: "foo@bar.com" }).onConflict({ on: "email", do: "ignore" })
	 *
	 * @example
	 * // Update on conflict
	 * table("users").insert({ email: "foo@bar.com", name: "Foo" }).onConflict({ on: "email", do: "update" })
	 *
	 * @example
	 * // Update specific columns
	 * table("users").insert({ email: "foo@bar.com", name: "Foo", age: 30 })
	 *   .onConflict({ on: "email", do: "update", updateColumns: ["name"] })
	 */
	onConflict(options: ConflictOptions): this;
}

/**
 * A query builder after calling insert({...}) to add a single row
 */
export type QueryBuilderWithInsertSingle = QueryBuilderWithInsert<Row, unknown>;

/**
 * A query builder after calling insert([{...}, {...}]) to add a multiple rows
 */
export type QueryBuilderWithInsertArray = QueryBuilderWithInsert<Row[], unknown[]>;

/**
 * A query builder after calling a byIdOrXXX(id) method to fetch a single row by id
 */
export type QueryBuilderWithById<T = Row, TSelect extends boolean = false> = Statement &
	ByIdExecutionMethods<T> &
	(TSelect extends true
		? SelectModifyColumns<QueryBuilderWithById<T, true>>
		: SelectSetInitialColumns<QueryBuilderWithById<T, true>>);

interface SelectSetInitialColumns<TReturn> extends SelectModifyColumns<TReturn> {
	/**
	 * Set the columns to select.
	 *
	 * @example
	 * table("artists").select("id", "name")
	 */
	select: (...columns: string[]) => TReturn;
}

interface SelectModifyColumns<TReturn> {
	/**
	 * Add additional columns to the SELECT clause.
	 *
	 * @example
	 * table("artists").select("id").addSelect("name", "bio")
	 */
	addSelect: (...columns: string[]) => TReturn;

	/**
	 * Replace all SELECT columns with new ones.
	 *
	 * @example
	 * const base = table("artists").select("id", "name");
	 * const idsOnly = base.replaceSelect("id");
	 */
	replaceSelect: (...columns: string[]) => TReturn;
}

interface OrderBySetInitial<TReturn> extends OrderByModify<TReturn> {
	/**
	 * Set the columns for the ORDER BY clause.
	 *
	 * @example
	 * table("artists").orderBy("lastName", "firstName DESC")
	 */
	orderBy: (...columns: string[]) => TReturn;
}

interface OrderByModify<TReturn> {
	/**
	 * Add additional columns to the ORDER BY clause.
	 *
	 * @example
	 * table("artists").orderBy("lastName").addOrderBy("firstName")
	 */
	addOrderBy: (...columns: string[]) => TReturn;

	/**
	 * Replace all ORDER BY columns with new ones.
	 *
	 * @example
	 * const base = table("artists").orderBy("name");
	 * const byDate = base.replaceOrderBy("created_at DESC");
	 */
	replaceOrderBy: (...columns: string[]) => TReturn;
}

interface SelectClauseMethods<TReturn> {
	/**
	 * Add a default JOIN clause (semantically equivalent to INNER JOIN).
	 *
	 * @example
	 * // Simple join
	 * table("artists").join("artworks ON artworks.artist_id = artists.id")
	 *
	 * @example
	 * // With parameter
	 * table("artists").join("artworks ON artworks.artist_id = artists.id AND artworks.year > ?", 2000)
	 *
	 * @example
	 * // With sql tag
	 * table("artists").join(sql`artworks ON artworks.artist_id = ${artistId}`)
	 */
	join: <S extends string | Statement>(clause: S, ...values: PlaceholderArgs<S>) => TReturn;

	/**
	 * Add an INNER JOIN clause.
	 *
	 * @example
	 * table("artists").innerJoin("artworks ON artworks.artist_id = artists.id")
	 */
	innerJoin: <S extends string | Statement>(clause: S, ...values: PlaceholderArgs<S>) => TReturn;

	/**
	 * Add a LEFT JOIN clause.
	 *
	 * @example
	 * table("artists").leftJoin("artworks ON artworks.artist_id = artists.id")
	 */
	leftJoin: <S extends string | Statement>(clause: S, ...values: PlaceholderArgs<S>) => TReturn;

	/**
	 * Add a RIGHT JOIN clause.
	 *
	 * @example
	 * table("employees").rightJoin("departments ON employees.department_id = departments.id")
	 */
	rightJoin: <S extends string | Statement>(clause: S, ...values: PlaceholderArgs<S>) => TReturn;

	/**
	 * Add a FULL OUTER JOIN clause.
	 *
	 * @example
	 * table("employees").fullJoin("projects ON employees.project_id = projects.id")
	 */
	fullJoin: <S extends string | Statement>(clause: S, ...values: PlaceholderArgs<S>) => TReturn;

	/**
	 * Add a CROSS JOIN clause.
	 *
	 * @example
	 * // Generate all size/colour combinations
	 * table("sizes").crossJoin("colours")
	 */
	crossJoin: (table: string) => TReturn;

	/**
	 * Add a HAVING condition. The method can be called multiple times to add
	 * more conditions which will be combined with AND.
	 *
	 * @example
	 * // Simple condition
	 * table("artworks")
	 *   .select("artist_id", "COUNT(*) as count")
	 *   .groupBy("artist_id")
	 *   .having("COUNT(*) > 5")
	 *
	 * @example
	 * // With parameter
	 * table("artworks")
	 *   .select("artist_id", "COUNT(*) as count")
	 *   .groupBy("artist_id")
	 *   .having("COUNT(*) > ?", minCount)
	 */
	having: <S extends string | Statement>(condition: S, ...values: PlaceholderArgs<S>) => TReturn;

	/**
	 * Add columns to the GROUP BY clause. Can be called multiple times.
	 *
	 * @example
	 * table("artworks").select("artist_id", "COUNT(*)").groupBy("artist_id")
	 */
	groupBy: (...columns: string[]) => TReturn;

	/**
	 * Set the LIMIT clause. Replaces any previous limit.
	 *
	 * @example
	 * table("artists").limit(10)
	 */
	limit: (n: number) => TReturn;

	/**
	 * Set the OFFSET clause. Replaces any previous offset.
	 *
	 * SQL does not permit an offset without a limit. If you do not provide a
	 * limit, then a default large limit of 2^31-1 will be automatically added.
	 *
	 * @example
	 * table("artists").limit(10).offset(20) // Records 21-30
	 * table("artists").offset(20) // Records 21 onwards
	 */
	offset: (n: number) => TReturn;

	/**
	 * Add DISTINCT to the SELECT clause.
	 *
	 * @example
	 * table("artworks").select("artist_id").distinct()
	 */
	distinct: () => TReturn;

	/**
	 * Add row-level locking (FOR UPDATE or FOR SHARE) to the query.
	 *
	 * SQLite ignores this. However SQLite does not support concurrent write
	 * transactions, so in effect every write transaction locks the whole
	 * database, making row-level locks redundant.
	 *
	 * @param options.mode - `update` (default) acquires an exclusive lock
	 *                preventing other transactions from locking the row.
	 *                `share` acquires a shared lock, permitting other shared
	 *                locks but not update locks.
	 * @param options.onLocked - Behaviour when the row is already locked:
	 *                `wait` (default) waits for the lock, `fail` fails
	 *                immediately, `skip` excludes locked rows from the result.
	 *
	 * @example
	 * // Lock row for update (default mode)
	 * table("accounts").where("id = 1").withRowLock()
	 *
	 * @example
	 * // Lock row for shared reading
	 * table("accounts").where("id = 1").withRowLock({ mode: "share" })
	 *
	 * @example
	 * // Fail immediately if lock cannot be acquired
	 * table("accounts").where("id = 1").withRowLock({ onLocked: "fail" })
	 */
	withRowLock: (options?: RowLockOptions) => TReturn;
}

interface ByIdMethods {
	/**
	 * Fetch a row by its id column, throwing QueryError if not found.
	 */
	byIdOrFail(id: unknown): QueryBuilderWithById<Row, false>;

	/**
	 * Fetch a row by its id column, throwing NotFoundError if not found.
	 */
	byIdOrNotFound(id: unknown): QueryBuilderWithById<Row, false>;

	/**
	 * Fetch a row by its id column, returning null if not found.
	 */
	byIdOrNull(id: unknown): QueryBuilderWithById<Row | null, false>;
}

interface WhereMethod<TReturn> {
	/**
	 * Add a WHERE condition. The method can be called multiple times to add
	 * more conditions which will be combined with AND.
	 *
	 * @example
	 * // Simple condition
	 * table("artists").where("age > 30")
	 *
	 * @example
	 * // Placeholders
	 * table("artists").where("age > ? AND status = ?", 30, "active")
	 *
	 * @example
	 * // With sql tag
	 * table("artists").where(sql`age > ${30}`)
	 *
	 * @example
	 * // With subquery
	 * table("artists").where("id IN ?", db.table("artworks").select("artist_id"))
	 * // -> WHERE id IN (SELECT "artist_id" FROM "artworks")
	 *
	 * @example
	 * // With array
	 * table("artists").where("id IN ?", [1, 2, 3])
	 * // -> WHERE id IN (1, 2, 3)
	 */
	where: <S extends string | Statement>(condition: S, ...values: PlaceholderArgs<S>) => TReturn;
}

interface InsertMethod<TSingle, TArray = TSingle> {
	/**
	 * Insert one or more rows into the table.
	 *
	 * @example
	 * // Single row
	 * await table("users").insert({ name: "Alice", age: 30 })
	 *
	 * @example
	 * // Multiple rows
	 * await table("users").insert([{ name: "Alice" }, { name: "Bob" }])
	 *
	 * @example
	 * // With explicit columns (values for unlisted columns will not be inserted)
	 * await table("users").insert({ name: "Alice", age: 30 }, { columns: ["name"] })
	 *
	 * @example
	 * // Insert from subquery with explicit columns
	 * await table("users").insert(sql`SELECT name, age FROM temp_users`, { columns: ["name", "age"] })
	 *
	 * @example
	 * // Values can be SQL expressions using the sql tag
	 * await table("users").insert({ name: "Alice", created_at: sql`NOW()` })
	 *
	 * @example
	 * // Values can be subqueries
	 * await table("users").insert({
	 *   name: "Alice",
	 *   team_id: table("teams").select("id").where("name = ?", "Default")
	 * })
	 */
	insert(values: Row, options?: InsertOptions): TSingle;
	insert(values: Row[], options?: InsertOptions): TArray;
	insert(statement: Statement, options?: InsertOptions): TArray;
}

// Query builder after calling returning() or returningId() on an insert
export type QueryBuilderWithReturning<T> = Statement & ReturningExecutionMethods<T>;

interface ReturningMethods<TReturning, TReturningId> {
	/**
	 * Add a RETURNING clause to return specified columns from inserted row(s).
	 *
	 * This returns an object containing the selected columns if you inserted a
	 * single object, or an array if you inserted an array of
	 * objects.
	 *
	 * @example
	 * const row = await table("users")
	 *   .insert({ name: "Alice", age: 30 })
	 *   .returning("id", "created_at");
	 */
	returning(...columns: string[]): QueryBuilderWithReturning<TReturning>;

	/**
	 * Add a RETURNING clause to return the auto-generated IDs of inserted
	 * row(s).
	 *
	 * This returns the id if you inserted an object, or an array of ids if you
	 * inserted an array of objects.
	 *
	 * @example
	 * const id = await table("users")
	 *   .insert({ name: "Alice" })
	 *   .returningId();
	 */
	returningId(): QueryBuilderWithReturning<TReturningId>;
}

interface BulkMutationMethods<TReturn = QueryBuilderWithMutation> {
	/**
	 * Delete all matching rows.
	 *
	 * @example
	 * await table("users").where("archived = true").deleteAll()
	 */
	deleteAll(): TReturn;

	/**
	 * Update all matching rows.
	 *
	 * @example
	 * await table("users").where("age > ?", 65).updateAll({ status: "retired" })
	 * // -> UPDATE "users" SET "status" = 'retired' WHERE "age" > 65
	 *
	 * @example
	 * // Values can be subqueries
	 * await table("users").where("id = ?", 1).updateAll({
	 *   team_id: table("teams").select("id").where("name = ?", "Default")
	 * })
	 * // -> UPDATE "users" SET "team_id" = (SELECT "id" FROM "teams" WHERE "name" = 'Default') WHERE "id" = 1
	 */
	updateAll(values: Row): TReturn;

	/**
	 * Update multiple rows with different values.
	 *
	 * @param source - Row or array of rows containing the new values. Each row
	 *   must include the matching column (defaults to "id").
	 * @param options.on - Column to match rows on. Defaults to "id".
	 * @param options.updateColumns - Columns to include in the update. Defaults
	 *   to all columns from the first row. Use this to select a subset of
	 *   properties when source objects contain extra fields.
	 *
	 * @example
	 * // Update multiple rows by id
	 * await table("users").updateFrom([
	 *   { id: 1, name: "Alice" },
	 *   { id: 2, name: "Bob" }
	 * ])
	 *
	 * @example
	 * // Match on a different column
	 * await table("users").updateFrom(rows, { on: "email" })
	 *
	 * @example
	 * // Select specific columns to update
	 * await table("users").updateFrom(rows, { updateColumns: ["id", "name"] })
	 */
	updateFrom(source: Row | Row[], options?: UpdateFromOptions): TReturn;
}

// For a SQL string with `?` placeholders, returns the required argument types
type PlaceholderArgs<S> = S extends string
	? string extends S
		? unknown[]
		: NTuple<CountPlaceholders<S>["length"]>
	: [];
type CountPlaceholders<S extends string> = S extends `${string}?${infer Rest}`
	? [1, ...CountPlaceholders<Rest>]
	: [];
type NTuple<N extends number, T = unknown, Acc extends T[] = []> = Acc["length"] extends N
	? Acc
	: NTuple<N, T, [...Acc, T]>;
