import { UnsupportedFeatureError } from "../database-errors.ts";
import { renderSqlFragments } from "../query-builder/statement-render.ts";
import type { SqlFragments } from "../query-types.ts";
import { DatabaseGrammar, identifier, type TransactionBeginOptions } from "./DatabaseGrammar.ts";

const ISOLATION_LEVEL_SQL: Record<string, string> = {
	"read-committed": "BEGIN ISOLATION LEVEL READ COMMITTED",
	"repeatable-read": "BEGIN ISOLATION LEVEL REPEATABLE READ",
	serializable: "BEGIN ISOLATION LEVEL SERIALIZABLE",
};

export class PostgresGrammar extends DatabaseGrammar {
	override readonly dialect = "postgresql";

	override compileTransactionBegin(options?: TransactionBeginOptions): string {
		if (options?.isolation) {
			return ISOLATION_LEVEL_SQL[options?.isolation] ?? "BEGIN";
		}
		return "BEGIN";
	}

	protected override compileDistinctOn(columns: string[]): string {
		if (columns.length === 0) {
			throw new UnsupportedFeatureError("DISTINCT ON with empty column list", this.dialect);
		}
		const quotedColumns = columns.map((col) => identifier(col)).join(", ");
		return `DISTINCT ON (${quotedColumns})`;
	}

	override compileFragments(statement: SqlFragments): string {
		return renderSqlFragments(statement, (i) => `$${i + 1}`);
	}

	override compileInsertDefaultValueRows(count: number): string {
		return "VALUES " + Array(count).fill("(DEFAULT)").join(", ");
	}
}
