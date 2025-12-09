import type {
	D1Database as D1DatabaseBinding,
	D1PreparedStatement,
	D1Result,
} from "@cloudflare/workers-types";
import { BaseClass } from "../../../utils.ts";
import type { Statement, StatementResult } from "../../contracts/Database.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import { renderStatementSql } from "../../sql.ts";
import type { D1DatabaseAdapterConfig } from "./D1DatabaseAdapterConfig.ts";

export class D1DatabaseAdapter extends BaseClass implements DatabaseAdapter {
	readonly #db: D1DatabaseBinding;

	constructor(config: D1DatabaseAdapterConfig) {
		super();
		this.#db = config.binding;
	}

	async run(statement: Statement): Promise<StatementResult> {
		const sqlString = toSql(statement);
		try {
			return this.#toStatementResult(await this.#prepare(statement).all());
		} catch (error) {
			throw makeQueryError(sqlString, error);
		}
	}

	async batch(statements: Statement[]): Promise<StatementResult[]> {
		if (statements.length === 0) return [];
		try {
			const results = await this.#db.batch(statements.map((stmt) => this.#prepare(stmt)));
			return results.map(this.#toStatementResult.bind(this));
		} catch (error) {
			// D1 doesn't indicate which statement in a batch failed, so we concatenate all SQL
			const sql = statements.map((s) => toSql(s)).join("; ");
			throw makeQueryError(sql, error);
		}
	}

	dispose(): void {
		// D1 binding is passed in via constructor, so we don't own it
	}

	#prepare(statement: Statement): D1PreparedStatement {
		const sqlString = toSql(statement);
		return this.#db.prepare(sqlString).bind(...statement.params);
	}

	#toStatementResult(result: D1Result): StatementResult {
		const rows = result.results as Record<string, unknown>[];
		return {
			rows,
			rowsAffected: rows.length > 0 ? rows.length : (result.meta.changes ?? 0),
		};
	}
}

function toSql(statement: Statement): string {
	return renderStatementSql(statement, () => "?");
}

function makeQueryError(sql: string, cause: unknown): QueryError {
	const error = cause as Error;
	const message = error.message ?? String(cause);

	return new QueryError(sql, message, cause, "D1_ERROR");
}
