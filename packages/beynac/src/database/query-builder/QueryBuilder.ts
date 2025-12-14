import type { Statement } from "../Statement.ts";

export interface LockOptions {
	skipLocked?: boolean | undefined;
	noWait?: boolean | undefined;
}

interface QueryBuilderBase extends Statement {
	/**
	 * Add a JOIN clause (equivalent to INNER JOIN).
	 *
	 * @example
	 * from("artists").join("artworks ON artworks.artist_id = artists.id")
	 */
	join(clause: string): this;

	/**
	 * Add an INNER JOIN clause.
	 *
	 * @example
	 * from("artists").innerJoin("artworks ON artworks.artist_id = artists.id")
	 */
	innerJoin(clause: string): this;

	/**
	 * Add a LEFT JOIN clause.
	 *
	 * @example
	 * from("artists").leftJoin("artworks ON artworks.artist_id = artists.id")
	 */
	leftJoin(clause: string): this;

	/**
	 * Add a RIGHT JOIN clause.
	 *
	 * @example
	 * from("employees").rightJoin("departments ON employees.department_id = departments.id")
	 */
	rightJoin(clause: string): this;

	/**
	 * Add a FULL OUTER JOIN clause.
	 *
	 * @example
	 * from("employees").fullJoin("projects ON employees.project_id = projects.id")
	 */
	fullJoin(clause: string): this;

	/**
	 * Add a CROSS JOIN clause.
	 *
	 * @example
	 * // Generate all size/colour combinations
	 * from("sizes").crossJoin("colours")
	 */
	crossJoin(table: string): this;

	/**
	 * Add a WHERE condition. The method can be called multiple times to add
	 * more conditions which will be combined with AND
	 *
	 * Each condition is wrapped in parentheses to preserve precedence when
	 * using OR within a condition.
	 *
	 * @example
	 * from("artists")
	 *   .where("age > 30")
	 *   .where("status = 'active' OR status = 'pending'")
	 * // → WHERE (age > 30) AND (status = 'active' OR status = 'pending')
	 */
	where(condition: string): this;

	/**
	 * Add columns to the GROUP BY clause. Can be called multiple times.
	 *
	 * @example
	 * from("artworks").select("artist_id", "COUNT(*)").groupBy("artist_id")
	 */
	groupBy(...columns: string[]): this;

	/**
	 * Add a HAVING condition. The method can be called multiple times to add
	 * more conditions which will be combined with AND.
	 *
	 * @example
	 * from("artworks")
	 *   .select("artist_id", "COUNT(*) as count")
	 *   .groupBy("artist_id")
	 *   .having("COUNT(*) > 5")
	 */
	having(condition: string): this;

	/**
	 * Add columns to the ORDER BY clause. Can be called multiple times.
	 *
	 * @example
	 * from("artists").orderBy("lastName", "firstName DESC")
	 */
	orderBy(...columns: string[]): this;

	/**
	 * Replace all ORDER BY columns with new ones.
	 *
	 * @example
	 * const base = from("artists").orderBy("name");
	 * const byDate = base.replaceOrderBy("created_at DESC");
	 */
	replaceOrderBy(...columns: string[]): this;

	/**
	 * Set the LIMIT clause. Replaces any previous limit.
	 *
	 * @example
	 * from("artists").limit(10)
	 */
	limit(n: number): this;

	/**
	 * Set the OFFSET clause. Replaces any previous offset.
	 *
	 * @example
	 * from("artists").limit(10).offset(20) // Page 3
	 */
	offset(n: number): this;

	/**
	 * Add DISTINCT to the SELECT clause.
	 *
	 * @example
	 * from("artworks").select("artist_id").distinct()
	 */
	distinct(): this;

	/**
	 * Add FOR UPDATE clause for exclusive row-level locking. Blocks other
	 * transactions from modifying or locking the selected rows.
	 *
	 * @example
	 * // Lock row for update within a transaction
	 * from("accounts").where("id = 1").forUpdate()
	 *
	 * @example
	 * // Fail immediately if row is already locked
	 * from("accounts").where("id = 1").forUpdate({ noWait: true })
	 *
	 * @param [options.noWait] - Fail immediately if lock cannot be acquired
	 * @param [options.skipLocked] - Skip rows that are already locked
	 */
	forUpdate(options?: LockOptions): this;

	/**
	 * Add FOR SHARE clause for shared row-level locking. Allows other
	 * transactions to read but not modify the selected rows.
	 *
	 * @example
	 * // Lock rows for reading within a transaction
	 * from("accounts").where("user_id = 1").forShare()
	 *
	 * @param [options.noWait] - Fail immediately if lock cannot be acquired
	 * @param [options.skipLocked] - Skip rows that are already locked
	 */
	forShare(options?: LockOptions): this;
}

/**
 * Query builder where SELECT columns have not yet been specified.
 */
export interface SelectNotSetQueryBuilder extends QueryBuilderBase {
	/**
	 * Set the columns to select. After calling this method, use `.addSelect()`
	 * to add more columns or `.replaceSelect()` to replace all columns.
	 *
	 * If `.select()` is never called, the query defaults to `SELECT *`.
	 *
	 * @example
	 * from("artists").select("id", "name")
	 */
	select(...columns: string[]): QueryBuilder;
}

/**
 * Fluent query builder for constructing SQL SELECT statements.
 */
export interface QueryBuilder extends QueryBuilderBase {
	/**
	 * Add additional columns to the SELECT clause.
	 *
	 * @example
	 * from("artists").select("id").addSelect("name", "bio")
	 */
	addSelect(...columns: string[]): this;

	/**
	 * Replace all SELECT columns with new ones.
	 *
	 * @example
	 * const base = from("artists").select("id", "name");
	 * const idsOnly = base.replaceSelect("id");
	 */
	replaceSelect(...columns: string[]): this;
}
