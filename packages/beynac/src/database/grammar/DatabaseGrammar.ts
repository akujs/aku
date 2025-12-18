import { arrayWrap, BaseClass } from "../../utils.ts";
import type { TransactionOptions } from "../DatabaseClient.ts";
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
	JoinType,
	LockOptions,
	QueryParts,
	SqlFragments,
	StringOrFragment,
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

	compileLock(type: "UPDATE" | "SHARE", options?: LockOptions): string {
		const parts = ["FOR", type];
		if (options?.noWait) parts.push("NOWAIT");
		if (options?.skipLocked) parts.push("SKIP LOCKED");
		return parts.join(" ");
	}

	compileReturning(columns: readonly string[] | null): string | null {
		if (columns === null) return null;
		if (columns.length === 0) return "RETURNING *";
		return "RETURNING " + columns.join(", ");
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
			return this.compileUpdate(state);
		}
		if (state.insert) {
			return this.compileInsert(state);
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

		return this.#mergeAndQuote([
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
			state.lock ? this.compileLock(state.lock.type, state.lock.options) : null,
		]);
	}

	/**
	 * Compile an INSERT query from builder state.
	 */
	compileInsert(state: QueryParts): SqlFragments {
		const insert = state.insert;
		if (!insert) {
			throw new Error("Internal error: cannot compile INSERT without data");
		}

		const { data, columns: explicitColumns } = insert;

		// INSERT...SELECT
		if (isSqlFragments(data)) {
			return this.#mergeAndQuote([
				"INSERT INTO",
				state.table,
				explicitColumns ? bracketedCommaSeparatedFragments(explicitColumns) : null,
				data,
				this.compileReturning(state.returningColumns),
			]);
		}

		const rows = arrayWrap(data);
		if (rows.length === 0) {
			throw new Error("Internal error: cannot compile INSERT without data");
		}

		const columns = explicitColumns ?? Object.keys(rows[0]);

		if (columns.length === 0) {
			return this.#mergeAndQuote([
				"INSERT INTO",
				state.table,
				this.compileInsertDefaultValueRows(rows.length),
				this.compileReturning(state.returningColumns),
			]);
		}

		return this.#mergeAndQuote([
			"INSERT INTO",
			state.table,
			bracketedCommaSeparatedFragments(columns),
			"VALUES",
			commaSeparatedFragments(
				rows.map((row) => bracketedCommaSeparatedParams(columns.map((col) => row[col]))),
			),
			this.compileReturning(state.returningColumns),
		]);
	}

	/**
	 * Compile an UPDATE query from builder state.
	 */
	compileUpdate(state: QueryParts): SqlFragments {
		if (!state.updateData) {
			throw new Error("Cannot compile UPDATE without data");
		}

		const setClauses = Object.entries(state.updateData).map(([col, value]): StringOrFragment[] => [
			col,
			"=",
			paramAsFragment(value),
		]);

		return this.#mergeAndQuote([
			"UPDATE",
			state.table,
			"SET",
			commaSeparatedFragments(setClauses),
			andClause("WHERE", state.where),
		]);
	}

	/**
	 * Compile a DELETE query from builder state.
	 */
	compileDelete(state: QueryParts): SqlFragments {
		return this.#mergeAndQuote(["DELETE FROM", state.table, andClause("WHERE", state.where)]);
	}

	#mergeAndQuote(parts: Array<Mergeable | Mergeable[]>): SqlFragments {
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

type Mergeable = StringOrFragment | SqlFragments | null | undefined;

function listClause(type: string, items: readonly string[]): Array<SqlFragments | string> {
	if (items.length === 0) {
		return [];
	}

	return [type, items.join(", ")];
}

function andClause(
	type: string,
	conditions: readonly SqlFragments[],
): Array<SqlFragments | string> {
	if (conditions.length === 0) {
		return [];
	}

	const result: Array<SqlFragments | string> = [type];

	result.push("(");
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
		} else {
			items.push(part);
		}
	}

	return { sqlFragments: items };
}
