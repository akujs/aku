import type { ReservedSql, Sql } from "postgres";
import { BaseClass } from "../../../utils.ts";
import type { Statement, StatementResult } from "../../contracts/Database.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import type { PostgresDatabaseAdapterConfig } from "./PostgresDatabaseAdapterConfig.ts";

type PostgresJS = Sql<Record<string, unknown>>;
type PostgresConnection = ReservedSql<Record<string, unknown>>;

export class PostgresDatabaseAdapter
	extends BaseClass
	implements DatabaseAdapter<PostgresConnection>
{
	readonly supportsTransactions = true;

	readonly #sql: PostgresJS;

	constructor(config: PostgresDatabaseAdapterConfig) {
		super();
		this.#sql = config.sql as PostgresJS;
	}

	async acquireConnection(): Promise<PostgresConnection> {
		return this.#sql.reserve();
	}

	releaseConnection(connection: PostgresConnection): void {
		connection.release();
	}

	async run(statement: Statement, connection: PostgresConnection): Promise<StatementResult> {
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
	}

	async batch(statements: Statement[], connection: PostgresConnection): Promise<StatementResult[]> {
		if (statements.length === 0) return [];

		// Postgres.js will use pipelining to send queries serially but
		// without waiting for each
		return Promise.all(statements.map((stmt) => this.run(stmt, connection)));
	}

	dispose(): void {
		// Sql instance is passed in via constructor, so we don't own it
	}
}

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
