import type { SqliteTransactionMode } from "../DatabaseClient.ts";
import { DatabaseGrammar, type TransactionBeginOptions } from "./DatabaseGrammar.ts";

const SQLITE_MODE_SQL: Record<SqliteTransactionMode, string> = {
	deferred: "BEGIN DEFERRED",
	immediate: "BEGIN IMMEDIATE",
	exclusive: "BEGIN EXCLUSIVE",
};

export class SqliteGrammar extends DatabaseGrammar {
	override transactionBegin(options?: TransactionBeginOptions): string {
		if (options?.sqliteMode) {
			return SQLITE_MODE_SQL[options.sqliteMode] ?? "BEGIN";
		}
		return "BEGIN";
	}
}
