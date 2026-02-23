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

export interface DistinctOptions {
	/**
	 * Columns for DISTINCT ON clause (PostgreSQL only - other databases will
	 * throw an error if you provide this option)
	 */
	on?: string[] | undefined;
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

export interface UnionEntry {
	type: "UNION" | "UNION ALL" | null;
	statement: SqlFragments;
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
	readonly distinct: DistinctOptions | null;
	readonly lock: LockPart | null;
	readonly insert: InsertPart | null;
	readonly conflict: ConflictOptions | null;
	readonly updateAll: Row | null;
	readonly updateFrom: UpdateFromPart | null;
	readonly deleteAll: boolean;
	readonly returningColumns: readonly string[] | null;
	readonly prepare: boolean | null;
	readonly exists: boolean;
	readonly unionMembers: readonly UnionEntry[] | null;
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

/**
 * A row of data returned by a query.
 */
export type Row = Record<
	string,
	// oxlint-disable-next-line no-explicit-any -- deliberate public API choice
	any
>;

/**
 * A SQL statement with an associated database client that can be executed
 * by calling execution methods like `.getAll()` or `.run()`.
 */
export interface ExecutableStatement extends Statement, StatementExecutionMethods {}

/**
 * A SQL statement with no associated database client. Calling execution methods
 * like `.getAll()` will use the default database client.
 */
export interface ExecutableStatementWithoutClient extends Statement, StatementExecutionMethods {
	/**
	 * Specify which database client to use.
	 */
	on(clientName: string): ExecutableStatement;
}

interface StatementExecutionMethods {
	/**
	 * Execute the statement on the default client and return the raw result
	 * with rows and rowsAffected.
	 */
	run(): Promise<StatementResult>;

	/**
	 * Execute the statement on the default client and return all rows.
	 */
	getAll(): Promise<Row[]>;

	/**
	 * Execute the statement on the default client and return the first row, or
	 * null if no rows returned.
	 */
	getFirstOrNull(): Promise<Row | null>;

	/**
	 * Execute the statement on the default client and return the first row.
	 * Throws AssertionError if no rows returned.
	 */
	getFirstOrFail(): Promise<Row>;

	/**
	 * Execute the statement on the default client and return the first row.
	 * Throws NotFoundError if no rows returned.
	 */
	getFirstOrNotFound(): Promise<Row>;

	/**
	 * Execute the statement on the default client and return the first column
	 * of the first row.
	 */
	// oxlint-disable-next-line no-explicit-any -- deliberate public API choice
	getScalar(): Promise<any>;

	/**
	 * Execute the statement on the default client and return the first column of all rows.
	 */
	// oxlint-disable-next-line no-explicit-any -- deliberate public API choice
	getColumn(): Promise<any[]>;

	/**
	 * Override the default behavior of whether to use prepared statements.
	 *
	 * This only has an effect on adapters that support prepared statements -
	 * currently only the Postgres adapter.
	 *
	 * @param value - Whether to use prepared statements. Defaults to `true`.
	 */
	withPrepare(value?: boolean): ExecutableStatement;
}

type MutationExecutionMethods = Pick<StatementExecutionMethods, "run" | "withPrepare">;

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
		StatementExecutionMethods,
		BulkMutationMethods<AnyQueryBuilder>,
		InsertMethod<AnyQueryBuilder, AnyQueryBuilder>,
		ReturningMethods,
		// oxlint-disable-next-line no-explicit-any -- deliberate public API choice
		RunAndReturnMethods<any, any>,
		WhereMethods<AnyQueryBuilder>,
		UnionMethods<AnyQueryBuilder>,
		SelectSetInitialColumns<AnyQueryBuilder>,
		OrderBySetInitial<AnyQueryBuilder>,
		SelectClauseMethods<AnyQueryBuilder>,
		AggregateMethods {}

/**
 * A query builder in its initial state, as returned by db.table()
 */
export interface QueryBuilder
	extends Statement,
		StatementExecutionMethods,
		ByIdMethods,
		InsertMethod<QueryBuilderWithInsertSingle, QueryBuilderWithInsertArray>,
		BulkMutationMethods,
		WhereMethods<QueryBuilderWithCondition>,
		UnionMethods<QueryBuilderWithUnion<false>>,
		SelectSetInitialColumns<SelectQueryBuilder<true, false>>,
		OrderBySetInitial<SelectQueryBuilder<false, true>>,
		SelectClauseMethods<SelectQueryBuilder<false, false>>,
		AggregateMethods {}

/**
 * Query builder after where() has been called. Permits bulk updates / deletes
 * and selects, but not inserts.
 */
export interface QueryBuilderWithCondition
	extends Statement,
		StatementExecutionMethods,
		ByIdMethods,
		BulkMutationMethods,
		WhereMethods<QueryBuilderWithCondition>,
		UnionMethods<QueryBuilderWithUnion<false>>,
		SelectSetInitialColumns<SelectQueryBuilder<true, false>>,
		OrderBySetInitial<SelectQueryBuilder<false, true>>,
		SelectClauseMethods<SelectQueryBuilder<false, false>>,
		AggregateMethods {}

/**
 * Select query builder after calling select() or a method like limit() that is
 * only valid on select queries.
 */
export type SelectQueryBuilder<
	TSelect extends boolean = false,
	TOrderBy extends boolean = false,
> = Statement &
	StatementExecutionMethods &
	ByIdMethods &
	WhereMethods<SelectQueryBuilder<TSelect, TOrderBy>> &
	UnionMethods<QueryBuilderWithUnion<false>> &
	SelectClauseMethods<SelectQueryBuilder<TSelect, TOrderBy>> &
	AggregateMethods &
	(TSelect extends true
		? SelectModifyColumns<SelectQueryBuilder<true, TOrderBy>>
		: SelectSetInitialColumns<SelectQueryBuilder<true, TOrderBy>>) &
	(TOrderBy extends true
		? OrderByModify<SelectQueryBuilder<TSelect, true>>
		: OrderBySetInitial<SelectQueryBuilder<TSelect, true>>);

/**
 * Query builder for INSERT statements. Supports RETURNING and ON CONFLICT.
 */
export interface QueryBuilderWithInsert<TReturning, TReturningId>
	extends Statement,
		MutationExecutionMethods,
		ReturningMethods,
		RunAndReturnMethods<TReturning, TReturningId> {
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
	onConflict(options: ConflictOptions): QueryBuilderWithInsert<TReturning, TReturningId>;
}

/**
 * A query builder after calling insert({...}) to add a single row
 */
export type QueryBuilderWithInsertSingle = QueryBuilderWithInsert<
	Row,
	// oxlint-disable-next-line no-explicit-any -- deliberate public API choice
	any
>;

/**
 * A query builder after calling insert([{...}, {...}]) to add a multiple rows
 */
export type QueryBuilderWithInsertArray = QueryBuilderWithInsert<
	Row[],
	// oxlint-disable-next-line no-explicit-any -- deliberate public API choice
	any[]
>;

/**
 * Query builder for UPDATE and DELETE statements. Supports RETURNING.
 */
export interface QueryBuilderWithBulkMutation
	extends Statement,
		MutationExecutionMethods,
		ReturningMethods,
		// oxlint-disable-next-line no-explicit-any -- deliberate public API choice
		RunAndReturnMethods<Row[], any[]> {}

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

interface LimitOffsetMethods<TReturn> {
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
}

interface SelectClauseMethods<TReturn> extends LimitOffsetMethods<TReturn> {
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
	 * Add DISTINCT to the SELECT clause.
	 *
	 * @example
	 * table("artworks").select("artist_id").distinct()
	 *
	 * @param options.on - Columns for DISTINCT ON clause (PostgreSQL only - other databases will throw an error if you provide this option)
	 */
	distinct: (options?: DistinctOptions) => TReturn;

	/**
	 * Order results randomly using the database's RANDOM() function.
	 *
	 * For large tables this is inefficient as it generates a random number for
	 * every matching row _before_ and sorts them before applying any LIMIT
	 * you've added, but for relatively small data sets it's an easy way to
	 * select one or more random rows.
	 *
	 * @example
	 * // Get a random quote
	 * await table("quotes").inRandomOrder().getFirstOrNull();
	 *
	 * @example
	 * // Get 5 random products
	 * table("products").inRandomOrder().limit(5)
	 */
	inRandomOrder: () => TReturn;

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

interface AggregateMethods {
	/**
	 * Execute the query returning a count of matching rows. This uses efficient
	 * COUNT() SQL syntax.
	 *
	 * @param column - count rows with non-null values in this column. Defaults to `*` meaning all rows.
	 *
	 * @example
	 * const count = await table("users").getCount();
	 *
	 * @example
	 * // Count active users with a non-null age
	 * const count = await table("users").where("active").getCount("age");
	 */
	getCount(column?: string): Promise<number>;

	/**
	 * Execute the query returning the minimum value of a column. This uses
	 * efficient MIN() SQL syntax.
	 *
	 * @example
	 * const cheapest = await table("products").where("active").getMin("price");
	 */
	getMin(column: string): Promise<number | null>;

	/**
	 * Execute the query returning the maximum value of a column. This uses
	 * efficient MAX() SQL syntax.
	 *
	 * @example
	 * const mostExpensive = await table("products").where("active").getMax("price");
	 */
	getMax(column: string): Promise<number | null>;

	/**
	 * Execute the query returning the average value of a column. This uses
	 * efficient AVG() SQL syntax.
	 *
	 * @example
	 * const avgPrice = await table("products").where("active").getAvg("price");
	 */
	getAvg(column: string): Promise<number | null>;

	/**
	 * Execute the query returning the sum of a column. This uses efficient SUM()
	 * SQL syntax.
	 *
	 * @example
	 * const totalRevenue = await table("orders").where("active").getSum("total");
	 */
	getSum(column: string): Promise<number | null>;

	/**
	 * Execute the query and return true if has rows. This uses efficient
	 * `SELECT EXISTS(...)` SQL syntax.
	 *
	 * @example
	 * const hasActiveUsers = await table("users").where("active").getExists();
	 */
	getExists(): Promise<boolean>;
}

interface ByIdMethods {
	/**
	 * Fetch a row by its id column, throwing QueryError if not found.
	 *
	 * Shorthand for `table.whereId(id).getFirstOrFail()`.
	 */
	getByIdOrFail(id: unknown): Promise<Row>;

	/**
	 * Fetch a row by its id column, throwing NotFoundError if not found.
	 *
	 * Shorthand for `table.whereId(id).getFirstOrNotFound()`.
	 */
	getByIdOrNotFound(id: unknown): Promise<Row>;

	/**
	 * Fetch a row by its id column, returning null if not found.
	 *
	 * Shorthand for `table.whereId(id).getFirstOrNull()`.
	 */
	getByIdOrNull(id: unknown): Promise<Row | null>;
}

interface WhereMethods<TReturn> {
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
	where<S extends string | Statement>(condition: S, ...values: PlaceholderArgs<S>): TReturn;

	/**
	 * Match only rows with a specific ID. This is a shorthand for `where("id = ?", id)`.
	 */
	whereId(id: unknown): TReturn;
}

interface UnionMethods<TReturn> {
	/**
	 * Combine results with another query using UNION, removing duplicates.
	 *
	 * @example
	 * table("users").select("name").union(table("admins").select("name"))
	 *
	 * @example
	 * // With sql literal
	 * table("users").select("id").union(sql`SELECT id FROM archived_users`)
	 */
	union(other: Statement): TReturn;

	/**
	 * Combine results with another query using UNION ALL, keeping duplicates.
	 *
	 * @example
	 * table("orders_2023").unionAll(table("orders_2024"))
	 */
	unionAll(other: Statement): TReturn;
}

/**
 * Query builder after calling union() or unionAll() on a query builder
 */
export type QueryBuilderWithUnion<TOrderBy extends boolean = false> = Statement &
	StatementExecutionMethods &
	UnionMethods<QueryBuilderWithUnion<TOrderBy>> &
	LimitOffsetMethods<QueryBuilderWithUnion<TOrderBy>> &
	(TOrderBy extends true
		? OrderByModify<QueryBuilderWithUnion<true>>
		: OrderBySetInitial<QueryBuilderWithUnion<true>>);

interface InsertMethod<TSingle, TArray> {
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
	insert<V extends Row | Row[] | Statement>(
		values: V,
		options?: InsertOptions,
	): V extends unknown[] ? TArray : V extends Statement ? TArray : TSingle;
}

interface ReturningMethods {
	/**
	 * Add a `RETURNING` clause to the query to return the data of affected rows.
	 * This method can be used with insert(), updateAll(), and deleteAll().
	 *
	 * This method does not execute the query, you need to call an execution
	 * method like .getAll(). For a shorthand, you may use `.runAndReturn()` to
	 * execute the query and return an array of rows.
	 *
	 * @example
	 * const rows = await table("users")
	 *   .insert({ name: "Alice", age: 30 })
	 *   .returning("id", "created_at")
	 *   .getAll();
	 *
	 * @param columns - Columns to return. Defaults to all columns (`*`).
	 */
	returning(...columns: string[]): ExecutableStatement;

	/**
	 * Add a `RETURNING "id"` clause to the query to return the ids of affected
	 * rows. This method can be used with insert(), updateAll(), and deleteAll().
	 *
	 * This method does not execute the query, you need to call an execution
	 * method like `.getColumn()`. For a shorthand, you may use
	 * `.runAndReturnId()` execute the query and return ids as an array.
	 *
	 * @example
	 * const aliceId = await table("users")
	 *   .insert({ name: "Alice" })
	 *   .returningId()
	 *   .getScalar();
	 *
	 * @example
	 * const deletedIds = await table("users")
	 *   .where("archived = ?", true)
	 *   .returningId()
	 *   .getColumn();
	 */
	returningId(): ExecutableStatement;
}

interface RunAndReturnMethods<TReturning, TReturningId> {
	/**
	 * Execute the query and return the affected rows.
	 *
	 * Returns an array of rows, except when an object (as opposed to an
	 * array) was passed to insert() in which case it returns a single row
	 *
	 * @example
	 * const row: Row = await table("users")
	 *   .insert({ name: "Alice", age: 30 })
	 *   .runAndReturn("id", "created_at");
	 *
	 * @example
	 * const rows: Row[] = await table("users")
	 *   .insert([{ name: "Alice", age: 30 }])
	 *   .runAndReturn("id", "created_at");
	 *
	 * @param columns - Columns to return. Defaults to all columns (`*`).
	 */
	runAndReturn(...columns: string[]): Promise<TReturning>;

	/**
	 * Execute the query and return the ids of affected rows
	 *
	 * Returns an array of ids, except when an object (as opposed to an
	 * array) was passed to insert() in which case it returns a single id
	 *
	 * @example
	 * const id: string = await table("users")
	 *   .insert({ name: "Alice" })
	 *   .runAndReturnId();
	 *
	 * @example
	 * const ids: string[] = await table("users")
	 *   .insert([{ name: "Alice" }])
	 *   .runAndReturnId();
	 */
	runAndReturnId(): Promise<TReturningId>;
}

interface BulkMutationMethods<TReturn = QueryBuilderWithBulkMutation> {
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
