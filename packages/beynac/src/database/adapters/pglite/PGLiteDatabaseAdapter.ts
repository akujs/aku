import { AsyncLocalStorage } from "node:async_hooks";
import { PGlite } from "@electric-sql/pglite";
import { BaseClass, exclusiveRunner, type Runner } from "../../../utils.ts";
import type { Statement, StatementResult } from "../../contracts/Database.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import { renderStatementSql } from "../../sql.ts";
import type { PGLiteDatabaseAdapterConfig } from "./PGLiteDatabaseAdapterConfig.ts";

export class PGLiteDatabaseAdapter extends BaseClass implements DatabaseAdapter {
	readonly #connectionStorage = new AsyncLocalStorage<ConnectionContext>();
	readonly #connectionRunner: Runner = exclusiveRunner();
	readonly #db: PGlite;

	constructor(config: PGLiteDatabaseAdapterConfig = {}) {
		super();
		this.#db = config.db ?? new PGlite();
	}

	async run(statement: Statement): Promise<StatementResult> {
		return this.#withConnection(async (): Promise<StatementResult> => {
			const sql = renderStatementSql(statement, (i) => `$${i + 1}`);
			try {
				await this.#db.waitReady;
				const result = await this.#db.query(sql, statement.params);
				return {
					rows: result.rows as Record<string, unknown>[],
					rowsAffected: result.rows.length > 0 ? result.rows.length : (result.affectedRows ?? 0),
				};
			} catch (error) {
				throw makeQueryError(sql, error);
			}
		});
	}

	async batch(statements: Statement[]): Promise<StatementResult[]> {
		return this.transaction(async () => {
			const results: StatementResult[] = [];
			for (const stmt of statements) {
				results.push(await this.run(stmt));
			}
			return results;
		});
	}

	async transaction<T>(fn: () => Promise<T>): Promise<T> {
		return this.#withConnection(async (ctx) => {
			const { depth } = ctx;
			const begin = depth === 0 ? "BEGIN" : `SAVEPOINT sp_${depth}`;
			const commit = depth === 0 ? "COMMIT" : `RELEASE SAVEPOINT sp_${depth}`;
			const rollback = depth === 0 ? "ROLLBACK" : `ROLLBACK TO SAVEPOINT sp_${depth}`;

			await this.#exec(begin);
			try {
				++ctx.depth;
				const result = await fn();
				await this.#exec(commit);
				return result;
			} catch (error) {
				await this.#exec(rollback);
				throw error;
			} finally {
				--ctx.depth;
			}
		});
	}

	async #withConnection<T>(f: (ctx: ConnectionContext) => Promise<T>): Promise<T> {
		const existingCtx = this.#connectionStorage.getStore();
		if (existingCtx) {
			return f(existingCtx);
		}

		return this.#connectionRunner(async () => {
			const ctx: ConnectionContext = { depth: 0 };
			return await this.#connectionStorage.run(ctx, () => f(ctx));
		});
	}

	async #exec(sql: string): Promise<void> {
		try {
			await this.#db.waitReady;
			await this.#db.query(sql);
		} catch (error) {
			throw makeQueryError(sql, error);
		}
	}

	async dispose(): Promise<void> {
		await this.#db.close();
	}
}

interface ConnectionContext {
	depth: number;
}

interface PGLiteError {
	message?: string;
	code?: string;
}

function makeQueryError(sql: string, cause: unknown): QueryError {
	const error = cause as PGLiteError;
	const message = error.message ?? String(cause);
	const code = error.code;

	return new QueryError(sql, message, cause, code);
}
