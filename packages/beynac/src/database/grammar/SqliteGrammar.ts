import type { SqliteTransactionMode } from "../DatabaseClient.ts";
import { UnsupportedFeatureError } from "../database-errors.ts";
import { renderSqlFragments } from "../query-builder/statement-render.ts";
import type { JoinType, SqlFragments } from "../query-types.ts";
import { DatabaseGrammar, type TransactionBeginOptions } from "./DatabaseGrammar.ts";

const SQLITE_MODE_SQL: Record<SqliteTransactionMode, string> = {
	deferred: "BEGIN DEFERRED",
	immediate: "BEGIN IMMEDIATE",
	exclusive: "BEGIN EXCLUSIVE",
};

export class SqliteGrammar extends DatabaseGrammar {
	override readonly dialect = "sqlite";

	override transactionBegin(options?: TransactionBeginOptions): string {
		if (options?.sqliteMode) {
			return SQLITE_MODE_SQL[options.sqliteMode] ?? "BEGIN";
		}
		return "BEGIN";
	}

	override compileJoin(type: JoinType, clause: string): string {
		if (type === "RIGHT JOIN" || type === "FULL OUTER JOIN") {
			throw new UnsupportedFeatureError(type, "SQLite");
		}
		return super.compileJoin(type, clause);
	}

	/**
	 * SQLite uses connection-level locking rather than row-level locks.
	 * FOR UPDATE/SHARE clauses are silently ignored as the semantic intent
	 * (preventing concurrent modification) is achieved by SQLite's architecture.
	 */
	override compileLock(): string {
		return "";
	}

	override compileFragments(statement: SqlFragments): string {
		return renderSqlFragments(statement, () => "?");
	}

	override compileInsertDefaultValueRows(count: number): string {
		return "(_rowid_) VALUES " + Array(count).fill("(NULL)").join(", ");
	}
}
