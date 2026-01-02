import { arrayWrap, BaseClass } from "../../utils.ts";
import type { TransactionOptions } from "../DatabaseClient.ts";
import { DatabaseError } from "../database-errors.ts";
import type { SqlDialect } from "../query-builder/dialect.ts";
import { quoteIdentifiers } from "../query-builder/quoteIdentifiers.ts";
import {
	bracketedCommaSeparatedFragments,
	bracketedCommaSeparatedParams,
	commaSeparatedFragments,
	isSqlFragments,
	paramAsFragment,
} from "../query-builder/statement-utils.ts";
import type {
	ConflictOptions,
	InsertPart,
	JoinType,
	LockPart,
	QueryParts,
	Row,
	SqlFragments,
	StringOrFragment,
	UpdateFromPart,
} from "../query-types.ts";

const DEFAULT_LIMIT_FOR_OFFSET: number = 2 ** 31 - 1;

export type TransactionBeginOptions = Pick<TransactionOptions, "isolation" | "sqliteMode">;

/**
 * Base class for database grammars used to generate SQL statements.
 * Database-specific grammars subclass this and override methods to
 * generate SQL for specific databases.
 */
export abstract class DatabaseGrammar extends BaseClass {
	abstract readonly dialect: SqlDialect;

	transactionBegin(_options?: TransactionBeginOptions): string {
		return "BEGIN";
	}

	transactionCommit(): string {
		return "COMMIT";
	}

	transactionRollback(): string {
		return "ROLLBACK";
	}

	savepointCreate(name: string): string {
		return `SAVEPOINT ${name}`;
	}

	savepointRelease(name: string): string {
		return `RELEASE SAVEPOINT ${name}`;
	}

	savepointRollback(name: string): string {
		return `ROLLBACK TO SAVEPOINT ${name}`;
	}

	compileJoin(type: JoinType, clause: string): string {
		return `${type} ${clause}`;
	}

	compileLock(lock: LockPart): string {
		const parts = ["FOR", lock.mode.toUpperCase()];
		if (lock.onLocked === "fail") parts.push("NOWAIT");
		if (lock.onLocked === "skip") parts.push("SKIP LOCKED");
		return parts.join(" ");
	}

	compileOnConflict(conflict: ConflictOptions, insertColumns: readonly string[]): string {
		const onColumns = arrayWrap(conflict.on);

		const quotedOnColumns = onColumns.map(quoteIdentifier).join(", ");

		if (conflict.do === "ignore") {
			return `ON CONFLICT (${quotedOnColumns}) DO NOTHING`;
		}

		let updateCols =
			conflict.updateColumns ?? insertColumns.filter((col) => !onColumns.includes(col));

		// SQL grammar requires at least one update column, if there are none,
		// make this a no-op by assigning the first ON column to itself
		if (updateCols.length === 0) {
			updateCols = [onColumns[0]];
		}

		const setClauses = updateCols
			.map((col) => `${quoteIdentifier(col)} = EXCLUDED.${quoteIdentifier(col)}`)
			.join(", ");

		return `ON CONFLICT (${quotedOnColumns}) DO UPDATE SET ${setClauses}`;
	}

	compileReturning(columns: readonly string[] | null): string | null {
		if (columns === null) return null;
		if (columns.length === 0) return "RETURNING *";
		return "RETURNING " + columns.map(quoteIdentifier).join(", ");
	}

	quoteIdentifiers(sql: string): string {
		return quoteIdentifiers(sql, this.dialect);
	}

	/**
	 * Compile a statement's fragments and params into a SQL string with appropriate placeholders.
	 */
	abstract compileFragments(statement: SqlFragments): string;

	/**
	 * Compile the columns and VALUES clause for inserting multiple rows with all default values.
	 */
	abstract compileInsertDefaultValueRows(count: number): string;

	/**
	 * Compile a query from builder state, dispatching to the appropriate
	 * compile method based on the state.
	 */
	compileQuery(state: QueryParts): SqlFragments {
		if (state.isDelete) {
			return this.compileDelete(state);
		}
		if (state.updateData) {
			return this.compileUpdate(state.updateData, state);
		}
		if (state.updateFrom) {
			return this.compileUpdateFrom(state.updateFrom, state);
		}
		if (state.insert) {
			return this.compileInsert(state.insert, state);
		}
		return this.compileSelect(state);
	}

	/**
	 * Compile a SELECT query from builder state.
	 */
	compileSelect(state: QueryParts): SqlFragments {
		const selectClause =
			"SELECT" +
			(state.distinct ? " DISTINCT " : " ") +
			(state.select.length > 0 ? state.select.join(", ") : "*");

		const limit = state.limit ?? (state.offset !== null ? DEFAULT_LIMIT_FOR_OFFSET : null);

		return this.mergeAndQuote([
			selectClause,
			"FROM",
			state.table,
			state.joins.flatMap(({ type, clause }) => [this.compileJoin(type, "").trim(), clause]),
			andClause("WHERE", state.where),
			listClause("GROUP BY", state.groupBy),
			andClause("HAVING", state.having),
			listClause("ORDER BY", state.orderBy),
			limit !== null ? `LIMIT ${limit}` : null,
			state.offset !== null ? `OFFSET ${state.offset}` : null,
			state.lock ? this.compileLock(state.lock) : null,
		]);
	}

	/**
	 * Compile an INSERT query from builder state.
	 */
	compileInsert(insert: InsertPart, state: QueryParts): SqlFragments {
		const { conflict } = state;

		// INSERT...SELECT
		if (isSqlFragments(insert.data)) {
			if (conflict?.do === "update" && !conflict.updateColumns && !insert.columns) {
				throw new DatabaseError(
					"Using insert(subquery).onConflict({do: 'update'}) requires you to specify the columns. " +
						"Either set options.columns in insert() or options.updateColumns in onConflict().",
				);
			}
			return this.compileInsertFromSubquery(insert.data, insert.columns, state);
		}

		const rows = arrayWrap(insert.data);
		if (rows.length === 0) {
			// Should never happen because we exit early on zero row insert
			throw new Error("Internal error: cannot compile INSERT without data");
		}

		const columns = insert.columns ?? Object.keys(rows[0]);

		if (columns.length === 0) {
			return this.mergeAndQuote([
				"INSERT INTO",
				state.table,
				this.compileInsertDefaultValueRows(rows.length),
				this.compileReturning(state.returningColumns),
			]);
		}

		const quotedColumns = columns.map(quoteIdentifier);

		return this.mergeAndQuote([
			"INSERT INTO",
			state.table,
			bracketedCommaSeparatedFragments(quotedColumns),
			"VALUES",
			commaSeparatedFragments(
				rows.map((row) => bracketedCommaSeparatedParams(columns.map((col) => row[col]))),
			),
			conflict ? this.compileOnConflict(conflict, columns) : null,
			this.compileReturning(state.returningColumns),
		]);
	}

	/**
	 * Compile an INSERT...SELECT query. Override in subclasses for database-specific behaviour.
	 */
	protected compileInsertFromSubquery(
		data: SqlFragments,
		columns: readonly string[] | null,
		state: QueryParts,
	): SqlFragments {
		const quotedColumns = columns?.map(quoteIdentifier) ?? null;

		return this.mergeAndQuote([
			"INSERT INTO",
			state.table,
			quotedColumns ? bracketedCommaSeparatedFragments(quotedColumns) : null,
			data,
			state.conflict ? this.compileOnConflict(state.conflict, columns ?? []) : null,
			this.compileReturning(state.returningColumns),
		]);
	}

	/**
	 * Compile an UPDATE query from builder state.
	 */
	compileUpdate(updateData: Row, state: QueryParts): SqlFragments {
		const setClauses = Object.entries(updateData).map(([col, value]): StringOrFragment[] => [
			quoteIdentifier(col),
			"=",
			paramAsFragment(value),
		]);

		return this.mergeAndQuote([
			"UPDATE",
			state.table,
			"SET",
			commaSeparatedFragments(setClauses),
			andClause("WHERE", state.where),
		]);
	}

	/**
	 * Compile an UPDATE query for bulk updates using CASE expressions.
	 * Generates: UPDATE table SET col = CASE on WHEN v1 THEN x WHEN v2 THEN y ELSE col END WHERE on IN (v1, v2)
	 */
	compileUpdateFrom({ data, on, updateColumns }: UpdateFromPart, state: QueryParts): SqlFragments {
		const setColumns = updateColumns.filter((col) => col !== on);
		const quotedOn = quoteIdentifier(on);

		const inColumns = new Set(data.map((row) => row[on]));
		const inCondition = [quotedOn, "IN", ...bracketedCommaSeparatedParams(inColumns)];

		return this.mergeAndQuote([
			"UPDATE",
			state.table,
			"SET",
			commaSeparatedFragments(
				setColumns.map((col) => {
					// col = CASE on WHEN key1 THEN val1 WHEN key2 THEN val2 ELSE col END
					const quotedCol = quoteIdentifier(col);
					const caseParts: StringOrFragment[] = [quotedCol, "= CASE", quotedOn];
					for (const row of data) {
						caseParts.push("WHEN", paramAsFragment(row[on]), "THEN", paramAsFragment(row[col]));
					}
					caseParts.push("ELSE", quotedCol, "END");
					return caseParts;
				}),
			),
			andClause("WHERE", [inCondition, ...state.where]),
		]);
	}

	/**
	 * Compile a DELETE query from builder state.
	 */
	compileDelete(state: QueryParts): SqlFragments {
		return this.mergeAndQuote(["DELETE FROM", state.table, andClause("WHERE", state.where)]);
	}

	protected mergeAndQuote(parts: Array<Mergeable | Mergeable[]>): SqlFragments {
		const merged = mergeFragments(parts.flat());
		const quotedItems = merged.sqlFragments.map((item): StringOrFragment => {
			if (typeof item === "string") {
				return this.quoteIdentifiers(item);
			}
			return { sql: this.quoteIdentifiers(item.sql), param: item.param };
		});
		return { sqlFragments: quotedItems };
	}
}

export type Mergeable = StringOrFragment | SqlFragments | StringOrFragment[] | null | undefined;

function listClause(type: string, items: readonly string[]): Array<SqlFragments | string> {
	if (items.length === 0) {
		return [];
	}

	return [type, items.join(", ")];
}

type Condition = SqlFragments | StringOrFragment[];

function andClause(type: string, conditions: readonly Condition[]): Mergeable[] {
	if (conditions.length === 0) {
		return [];
	}

	const result: Mergeable[] = [type, "("];

	for (let i = 0; i < conditions.length; i++) {
		if (i > 0) {
			result.push(") AND (");
		}
		result.push(conditions[i]);
	}
	result.push(")");

	return result;
}

function mergeFragments(parts: Array<Mergeable>): SqlFragments {
	const items: StringOrFragment[] = [];

	for (const part of parts) {
		if (!part) continue;
		if (typeof part === "string") {
			items.push(part);
		} else if (isSqlFragments(part)) {
			items.push(...part.sqlFragments);
		} else if (Array.isArray(part)) {
			items.push(...part);
		} else {
			items.push(part);
		}
	}

	return { sqlFragments: items };
}

export function quoteIdentifier(identifier: string): string {
	return '"' + identifier.replaceAll('"', '""') + '"';
}
