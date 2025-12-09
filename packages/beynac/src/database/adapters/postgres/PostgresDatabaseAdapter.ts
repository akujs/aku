import { AsyncLocalStorage } from "node:async_hooks";
import type { Sql } from "postgres";
import { BaseClass } from "../../../utils.ts";
import type { Statement, StatementResult } from "../../contracts/Database.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import type { PostgresDatabaseAdapterConfig } from "./PostgresDatabaseAdapterConfig.ts";

export class PostgresDatabaseAdapter extends BaseClass implements DatabaseAdapter {
	readonly #sql: PostgresJS;
	readonly #connectionStorage = new AsyncLocalStorage<ConnectionContext>();

	constructor(config: PostgresDatabaseAdapterConfig) {
		super();
		this.#sql = config.sql as PostgresJS;
	}

	async run(statement: Statement): Promise<StatementResult> {
		return this.#withConnection(async ({ connection }) => {
			const sqlString = toSql(statement);
			try {
				const result = await connection.unsafe(sqlString, statement.params);
				return {
					rows: result as Record<string, unknown>[],
					rowsAffected: result.count ?? result.length,
				};
			} catch (error) {
				throw makeQueryError(sqlString, error);
			}
		});
	}

	async batch(statements: Statement[]): Promise<StatementResult[]> {
		if (statements.length === 0) return [];

		return this.transaction(async () => {
			// Postgres.js will use pipelining to send queries serially but
			// without waiting for each
			return Promise.all(statements.map((stmt) => this.run(stmt)));
		});
	}

	async transaction<T>(fn: () => Promise<T>): Promise<T> {
		return this.#withConnection(async (ctx) => {
			const { depth } = ctx;
			const begin = depth === 0 ? "BEGIN" : `SAVEPOINT sp_${depth}`;
			const commit = depth === 0 ? "COMMIT" : `RELEASE SAVEPOINT sp_${depth}`;
			const rollback = depth === 0 ? "ROLLBACK" : `ROLLBACK TO SAVEPOINT sp_${depth}`;

			await ctx.connection.unsafe(begin);
			try {
				++ctx.depth;
				const result = await fn();
				await ctx.connection.unsafe(commit);
				return result;
			} catch (error) {
				await ctx.connection.unsafe(rollback);
				throw error;
			} finally {
				--ctx.depth;
			}
		});
	}

	dispose(): void {
		// Sql instance is passed in via constructor, so we don't own it
	}

	async #withConnection<T>(f: (ctx: ConnectionContext) => Promise<T>): Promise<T> {
		const existingCtx = this.#connectionStorage.getStore();
		if (existingCtx) {
			return f(existingCtx);
		}

		const connection = await this.#sql.reserve();
		try {
			const ctx: ConnectionContext = { connection, depth: 0 };
			return await this.#connectionStorage.run(ctx, () => f(ctx));
		} finally {
			connection.release();
		}
	}
}

interface ConnectionContext {
	connection: PostgresJS;
	depth: number;
}

type PostgresJS = Sql<{ allow: unknown }>;

interface PostgresError {
	code?: string;
	message?: string;
}

function toSql(statement: Statement): string {
	return statement.renderSql((i) => `$${i + 1}`);
}

function makeQueryError(sql: string, cause: unknown): QueryError {
	const error = cause as PostgresError;
	return new QueryError(sql, error.message ?? String(cause), cause, error.code);
}
