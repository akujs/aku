import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { BaseClass } from "../../../utils.ts";
import type { CompiledQuery, DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import type { DatabaseGrammar } from "../../grammar/DatabaseGrammar.ts";
import { SqliteGrammar } from "../../grammar/SqliteGrammar.ts";
import type { StatementResult } from "../../Statement.ts";
import type { D1DatabaseAdapterConfig } from "./D1DatabaseAdapterConfig.ts";

export class D1DatabaseAdapter extends BaseClass implements DatabaseAdapter<D1Database> {
	readonly grammar: DatabaseGrammar = new SqliteGrammar();
	readonly supportsTransactions = false;
	readonly transactionOptions = undefined;

	readonly #d1: D1Database;

	constructor(config: D1DatabaseAdapterConfig) {
		super();
		this.#d1 = config.binding;
	}

	async acquireConnection(): Promise<D1Database> {
		return this.#d1;
	}

	releaseConnection(): void {}

	async run(sql: string, params: unknown[]): Promise<StatementResult> {
		try {
			return this.#toStatementResult(await this.#prepare(sql, params).all());
		} catch (error) {
			throw makeQueryError(sql, error);
		}
	}

	async batch(queries: CompiledQuery[]): Promise<StatementResult[]> {
		if (queries.length === 0) return [];
		try {
			const results = await this.#d1.batch(
				queries.map(({ sql, params }) => this.#prepare(sql, params)),
			);
			return results.map(this.#toStatementResult.bind(this));
		} catch (error) {
			// D1 doesn't indicate which statement in a batch failed, so we concatenate all SQL
			const allSql = queries.map(({ sql }) => sql).join("; ");
			throw makeQueryError(allSql, error);
		}
	}

	dispose(): void {}

	#prepare(sql: string, params: unknown[]): D1PreparedStatement {
		return this.#d1.prepare(sql).bind(...params);
	}

	#toStatementResult(result: D1Result): StatementResult {
		const rows = result.results as Record<string, unknown>[];
		return {
			rows,
			rowsAffected: rows.length > 0 ? rows.length : (result.meta.changes ?? 0),
		};
	}
}

function makeQueryError(sql: string, cause: unknown): QueryError {
	const error = cause as Error;
	const message = error.message ?? String(cause);

	return new QueryError(sql, message, cause, "D1_ERROR");
}
