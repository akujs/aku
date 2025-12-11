import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { BaseClass } from "../../../utils.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import type { DatabaseGrammar } from "../../grammar/DatabaseGrammar.ts";
import { SqliteGrammar } from "../../grammar/SqliteGrammar.ts";
import type { Statement, StatementResult } from "../../Statement.ts";
import type { D1DatabaseAdapterConfig } from "./D1DatabaseAdapterConfig.ts";

export class D1DatabaseAdapter extends BaseClass implements DatabaseAdapter<D1Database> {
	readonly grammar: DatabaseGrammar = new SqliteGrammar();
	readonly supportsTransactions = false;

	readonly #d1: D1Database;

	constructor(config: D1DatabaseAdapterConfig) {
		super();
		this.#d1 = config.binding;
	}

	async acquireConnection(): Promise<D1Database> {
		return this.#d1;
	}

	releaseConnection(): void {}

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
			const results = await this.#d1.batch(statements.map((stmt) => this.#prepare(stmt)));
			return results.map(this.#toStatementResult.bind(this));
		} catch (error) {
			// D1 doesn't indicate which statement in a batch failed, so we concatenate all SQL
			const sql = statements.map((s) => toSql(s)).join("; ");
			throw makeQueryError(sql, error);
		}
	}

	dispose(): void {}

	#prepare(statement: Statement): D1PreparedStatement {
		const sqlString = toSql(statement);
		return this.#d1.prepare(sqlString).bind(...statement.params);
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
	return statement.renderSql(() => "?");
}

function makeQueryError(sql: string, cause: unknown): QueryError {
	const error = cause as Error;
	const message = error.message ?? String(cause);

	return new QueryError(sql, message, cause, "D1_ERROR");
}
