import type {
	D1Database as D1DatabaseBinding,
	D1PreparedStatement,
	D1Result,
} from "@cloudflare/workers-types";
import { BaseClass } from "../../../utils.ts";
import type { Database, Statement, StatementResult } from "../../contracts/Database.ts";
import { DatabaseError, QueryError } from "../../database-errors.ts";

export interface D1DatabaseConfig {
	binding: D1DatabaseBinding;
}

export class D1Database extends BaseClass implements Database {
	readonly supportsTransactions = false;
	readonly #db: D1DatabaseBinding;

	constructor(config: D1DatabaseConfig) {
		super();
		this.#db = config.binding;
	}

	async run(statement: Statement): Promise<StatementResult> {
		try {
			return this.#toStatementResult(await this.#prepare(statement).all());
		} catch (error) {
			throw makeQueryError(statement, error);
		}
	}

	async batch(statements: Statement[]): Promise<StatementResult[]> {
		if (statements.length === 0) {
			return [];
		}

		try {
			const results = await this.#db.batch(
				statements.map((stmt) => this.#db.prepare(stmt.sql).bind(...stmt.params)),
			);
			return results.map(this.#toStatementResult.bind(this));
		} catch (error) {
			// D1 doesn't indicate which statement in a batch failed, so we concatenate all SQL
			const sql = statements.map((s) => s.sql).join("; ");
			throw makeQueryError({ sql, params: [] }, error);
		}
	}

	async transaction<T>(_fn: () => Promise<T>): Promise<T> {
		throw new DatabaseError(
			"D1 does not support interactive transactions. Use batch() for atomic operations.",
		);
	}

	#prepare(statement: Statement): D1PreparedStatement {
		return this.#db.prepare(statement.sql).bind(...statement.params);
	}

	#toStatementResult(result: D1Result): StatementResult {
		const rows = result.results as Record<string, unknown>[];
		return {
			rows,
			rowsAffected: rows.length > 0 ? rows.length : (result.meta.changes ?? 0),
		};
	}
}

export function d1Database(config: D1DatabaseConfig): Database {
	return new D1Database(config);
}

function makeQueryError(statement: Statement, cause: unknown): QueryError {
	const error = cause as Error;
	const message = error.message ?? String(cause);

	return new QueryError(statement.sql, message, cause, "D1_ERROR");
}
