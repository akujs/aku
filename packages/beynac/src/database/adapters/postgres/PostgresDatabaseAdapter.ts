import type { ReservedSql, Sql } from "postgres";
import { BaseClass } from "../../../utils.ts";
import type { CompiledQuery, DatabaseAdapter } from "../../DatabaseAdapter.ts";
import type { TransactionOptions } from "../../DatabaseClient.ts";
import { QueryError } from "../../database-errors.ts";
import type { DatabaseGrammar } from "../../grammar/DatabaseGrammar.ts";
import { PostgresGrammar } from "../../grammar/PostgresGrammar.ts";
import type { Row, StatementResult } from "../../query-types.ts";
import type { PostgresDatabaseAdapterConfig } from "./PostgresDatabaseAdapterConfig.ts";

type PostgresJS = Sql<Row>;
type PostgresConnection = ReservedSql<Row>;

export class PostgresDatabaseAdapter
	extends BaseClass
	implements DatabaseAdapter<PostgresConnection>
{
	readonly grammar: DatabaseGrammar = new PostgresGrammar();
	readonly supportsTransactions = true;
	readonly transactionOptions: TransactionOptions;

	readonly #sql: PostgresJS;

	constructor(config: PostgresDatabaseAdapterConfig) {
		super();
		this.#sql = config.sql as PostgresJS;
		this.transactionOptions = Object.freeze({
			retry: config.transactionRetry,
			isolation: config.transactionIsolation,
		});
	}

	async acquireConnection(): Promise<PostgresConnection> {
		return this.#sql.reserve();
	}

	releaseConnection(connection: PostgresConnection): void {
		connection.release();
	}

	async run(
		sql: string,
		params: unknown[],
		connection: PostgresConnection,
	): Promise<StatementResult> {
		try {
			const result = await connection.unsafe(sql, params);
			return {
				rows: result as Row[],
				rowsAffected: result.count ?? result.length,
			};
		} catch (error) {
			throw makeQueryError(sql, error);
		}
	}

	async batch(
		queries: CompiledQuery[],
		connection: PostgresConnection,
	): Promise<StatementResult[]> {
		if (queries.length === 0) return [];

		// Postgres.js will use pipelining to send queries serially but
		// without waiting for each
		return Promise.all(queries.map(({ sql, params }) => this.run(sql, params, connection)));
	}

	dispose(): void {}
}

interface PostgresError {
	code?: string;
	message?: string;
}

function makeQueryError(sql: string, cause: unknown): QueryError {
	const error = cause as PostgresError;
	return new QueryError(sql, error.message ?? String(cause), cause, error.code);
}
