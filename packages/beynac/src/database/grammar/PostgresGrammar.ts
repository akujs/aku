import { renderSql } from "../query-builder/statement-render.ts";
import type { SqlFragments } from "../Statement.ts";
import { DatabaseGrammar, type TransactionBeginOptions } from "./DatabaseGrammar.ts";

const ISOLATION_LEVEL_SQL: Record<string, string> = {
	"read-committed": "BEGIN ISOLATION LEVEL READ COMMITTED",
	"repeatable-read": "BEGIN ISOLATION LEVEL REPEATABLE READ",
	serializable: "BEGIN ISOLATION LEVEL SERIALIZABLE",
};

export class PostgresGrammar extends DatabaseGrammar {
	override readonly dialect = "postgresql";

	override transactionBegin(options?: TransactionBeginOptions): string {
		if (options?.isolation) {
			return ISOLATION_LEVEL_SQL[options?.isolation] ?? "BEGIN";
		}
		return "BEGIN";
	}

	override compileStatement(statement: SqlFragments): string {
		return renderSql(statement, (i) => `$${i + 1}`);
	}
}
