export interface SqlFragment {
	sql: string;
	param: unknown;
}

export type StringOrFragment = string | SqlFragment;

export interface SqlFragments {
	get sqlFragments(): readonly StringOrFragment[];
}

export interface Statement extends SqlFragments {
	/**
	 * Render this statement for logging, with parameter values inlined.
	 */
	toHumanReadableSql(): string;
}

export interface LockOptions {
	skipLocked?: boolean | undefined;
	noWait?: boolean | undefined;
}

export interface MutationResult {
	rowsAffected: number;
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
export interface ExecutableStatement extends Statement, StatementExecutionMethods {}

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
	all<T = Row>(): Promise<T[]>;

	/**
	 * Execute the statement on the default client and return the first row.
	 * Throws if no rows returned.
	 */
	first<T = Row>(): Promise<T>;

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
	 * This `then` method allows awaiting the Sql object directly
	 *
	 * The return type is equivalent to calling all().
	 *
	 * @example
	 * const allRows = await sql`SELECT * FROM users`;
	 */
	then: Promise<Row[]>["then"];
}

/**
 * An interface with all query builder methods. Normally you will be working
 * with one of the more specific builder types but this can be used when you
 * need to accept any kind of builder.
 */
export interface AnyQueryBuilder
	extends Statement,
		BulkMutationMethods,
		InsertMethod<AnyQueryBuilder>,
		InsertResultMethods,
		WhereMethod<AnyQueryBuilder>,
		SelectSetInitialColumns<AnyQueryBuilder>,
		SelectClauseMethods<AnyQueryBuilder> {}

/**
 * A query builder in its initial state, as returned by db.table()
 */
export interface QueryBuilder
	extends Statement,
		InsertMethod<QueryBuilderWithInsert>,
		BulkMutationMethods,
		WhereMethod<QueryBuilderWithCondition>,
		SelectSetInitialColumns<QueryBuilderForSelectWithColumns>,
		SelectClauseMethods<QueryBuilderForSelect> {}

/**
 * Query builder after where() has been called. Permits bulk updates / deletes
 * and selects, but not inserts.
 */
export interface QueryBuilderWithCondition
	extends Statement,
		BulkMutationMethods,
		WhereMethod<QueryBuilderWithCondition>,
		SelectSetInitialColumns<QueryBuilderForSelectWithColumns>,
		SelectClauseMethods<QueryBuilderForSelect> {}

/**
 * Query builder for SELECT statements before columns have been set.
 * Calling select(), addSelect(), or replaceSelect() transitions to SelectBuilderWithColumns.
 */
export interface QueryBuilderForSelect
	extends Statement,
		WhereMethod<QueryBuilderForSelect>,
		SelectSetInitialColumns<QueryBuilderForSelectWithColumns>,
		SelectClauseMethods<QueryBuilderForSelect> {}

/**
 * Query builder for SELECT statements after columns have been set.
 * The select() method is no longer available, use addSelect() or replaceSelect()
 * to modify columns.
 */
export interface QueryBuilderForSelectWithColumns
	extends Statement,
		WhereMethod<QueryBuilderForSelectWithColumns>,
		SelectModifyColumns<QueryBuilderForSelectWithColumns>,
		SelectClauseMethods<QueryBuilderForSelectWithColumns> {}

/**
 * Query builder for INSERT statements
 */
export interface QueryBuilderWithInsert extends Statement, InsertResultMethods {}

interface InsertResultMethods {
	/**
	 * Execute the insert and return specified columns from inserted rows.
	 *
	 * @example
	 * const results = await table("users")
	 *   .insert({ name: "Alice", age: 30 })
	 *   .returning("id", "created_at");
	 */
	returning<T extends string>(...columns: T[]): Promise<Record<T, unknown>[]>;

	/**
	 * Execute the insert and return the auto-generated IDs of inserted rows.
	 *
	 * @example
	 * const ids = await table("users")
	 *   .insert([{ name: "Alice" }, { name: "Bob" }])
	 *   .returningId();
	 */
	returningId<T = number>(column?: string): Promise<T[]>;

	/**
	 * Execute the insert and return the mutation result. This makes the builder
	 * awaitable directly.
	 *
	 * @example
	 * const result = await table("users").insert({ name: "Alice", age: 30 });
	 * console.log(result.rowsAffected); // 1
	 */
	then: Promise<MutationResult>["then"];
}

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
	 * Add columns to the ORDER BY clause. Can be called multiple times.
	 *
	 * @example
	 * table("artists").orderBy("lastName", "firstName DESC")
	 */
	orderBy: (...columns: string[]) => TReturn;

	/**
	 * Replace all ORDER BY columns with new ones.
	 *
	 * @example
	 * const base = table("artists").orderBy("name");
	 * const byDate = base.replaceOrderBy("created_at DESC");
	 */
	replaceOrderBy: (...columns: string[]) => TReturn;

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
	 * Add FOR UPDATE clause for exclusive row-level locking. Blocks other
	 * transactions from modifying or locking the selected rows.
	 *
	 * SQLite ignores this. However SQLite does not support concurrent write
	 * transactions, so in effect every write transaction locks the whole
	 * database, so row-level locks are redundant.
	 *
	 * @example
	 * // Lock row for update within a transaction
	 * table("accounts").where("id = 1").forUpdate()
	 *
	 * @example
	 * // Fail immediately if row is already locked
	 * table("accounts").where("id = 1").forUpdate({ noWait: true })
	 *
	 * @param [options.noWait] - Fail immediately if lock cannot be acquired
	 * @param [options.skipLocked] - Skip rows that are already locked
	 */
	forUpdate: (options?: LockOptions) => TReturn;

	/**
	 * Add FOR SHARE clause for shared row-level locking. Allows other
	 * transactions to read but not modify the selected rows.
	 *
	 * @example
	 * // Lock rows for reading within a transaction
	 * table("accounts").where("user_id = 1").forShare()
	 *
	 * @param [options.noWait] - Fail immediately if lock cannot be acquired
	 * @param [options.skipLocked] - Skip rows that are already locked
	 */
	forShare: (options?: LockOptions) => TReturn;
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

interface InsertMethod<TReturn> {
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
	 */
	insert(values: Record<string, unknown>): TReturn;
	insert(values: Record<string, unknown>[]): TReturn;
	insert(statement: Statement): TReturn;
}

interface BulkMutationMethods {
	/**
	 * Delete all matching rows. Use where() to filter.
	 *
	 * @example
	 * await table("users").where("archived = true").deleteAll()
	 */
	deleteAll(): Promise<MutationResult>;

	/**
	 * Update all matching rows. Use where() to filter.
	 *
	 * @example
	 * await table("users").where("age > ?", 65).updateAll({ status: "retired" })
	 */
	updateAll(values: Record<string, unknown>): Promise<MutationResult>;
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
