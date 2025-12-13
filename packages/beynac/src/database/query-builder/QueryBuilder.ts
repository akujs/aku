import type { Statement } from "../Statement.ts";

/**
 * Base interface for query builders with common SQL clause methods.
 *
 * All methods return `this` to allow fluent chaining while preserving
 * the specific builder type through the chain.
 */
interface QueryBuilderBase extends Statement {
	/**
	 * Add a JOIN clause.
	 *
	 * @example
	 * from("artists").join("artworks ON artworks.artist_id = artists.id")
	 */
	join(clause: string): this;

	/**
	 * Add an INNER JOIN clause (explicit form of join()).
	 */
	innerJoin(clause: string): this;

	/**
	 * Add a LEFT JOIN clause.
	 */
	leftJoin(clause: string): this;

	/**
	 * Add a RIGHT JOIN clause.
	 */
	rightJoin(clause: string): this;

	/**
	 * Add a FULL OUTER JOIN clause.
	 */
	fullJoin(clause: string): this;

	/**
	 * Add a CROSS JOIN clause.
	 */
	crossJoin(table: string): this;

	/**
	 * Add a WHERE condition. Multiple calls are ANDed together.
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
	 * Add columns to the GROUP BY clause. Multiple calls accumulate.
	 */
	groupBy(...columns: string[]): this;

	/**
	 * Add a HAVING condition. Multiple calls are ANDed together.
	 */
	having(condition: string): this;

	/**
	 * Add columns to the ORDER BY clause. Multiple calls accumulate.
	 *
	 * @example
	 * from("artists").orderBy("lastName", "firstName DESC")
	 */
	orderBy(...columns: string[]): this;

	/**
	 * Replace all ORDER BY columns with new ones.
	 */
	replaceOrderBy(...columns: string[]): this;

	/**
	 * Set the LIMIT clause. Replaces any previous limit.
	 */
	limit(n: number): this;

	/**
	 * Set the OFFSET clause. Replaces any previous offset.
	 */
	offset(n: number): this;

	/**
	 * Add DISTINCT to the SELECT clause.
	 */
	distinct(): this;

	/**
	 * Add FOR UPDATE clause for row-level locking.
	 *
	 * @param [option] - Optional modifier like "NOWAIT" or "SKIP LOCKED"
	 */
	forUpdate(option?: string): this;

	/**
	 * Add FOR SHARE clause for row-level locking.
	 */
	forShare(): this;
}

// Query builder where SELECT columns have not yet been specified.
// Use .select() to specify columns, which returns a QueryBuilder with
// access to .addSelect() and .replaceSelect().
// If no columns are specified before execution, defaults to SELECT *.
export interface SelectNotSetQueryBuilder extends QueryBuilderBase {
	/**
	 * Set the columns to select.
	 *
	 * After calling this method, use `.addSelect()` to add more columns
	 * or `.replaceSelect()` to replace all columns.
	 */
	select(...columns: string[]): QueryBuilder;
}

// Fluent query builder for constructing SQL SELECT statements.
// Each method returns a new QueryBuilder instance (immutable), allowing
// branching and reuse of partial queries.
export interface QueryBuilder extends QueryBuilderBase {
	/**
	 * Add additional columns to the SELECT clause.
	 */
	addSelect(...columns: string[]): this;

	/**
	 * Replace all SELECT columns with new ones.
	 */
	replaceSelect(...columns: string[]): this;
}
