import { PGlite } from "@electric-sql/pglite";
import { BaseClass, type FifoLock, fifoLock } from "../../../utils.ts";
import type {
	DatabaseAdapter,
	DatabaseAdapterBatchOptions,
	DatabaseAdapterRunOptions,
} from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import type { DatabaseGrammar } from "../../grammar/DatabaseGrammar.ts";
import { PostgresGrammar } from "../../grammar/PostgresGrammar.ts";
import type { Row, StatementResult } from "../../query-types.ts";
import type { PGLiteDatabaseAdapterConfig } from "./PGLiteDatabaseAdapterConfig.ts";

// PGLite only supports single-connection access, so we use the PGlite instance
// itself as the "connection" type and serialize access via fifoLock
export class PGLiteDatabaseAdapter extends BaseClass implements DatabaseAdapter<PGlite> {
	readonly grammar: DatabaseGrammar = new PostgresGrammar();
	readonly supportsTransactions = true;
	readonly transactionOptions = undefined;

	readonly #db: PGlite;
	readonly #lock: FifoLock<PGlite>;

	constructor(config: PGLiteDatabaseAdapterConfig = {}) {
		super();
		this.#db = config.db ?? new PGlite();
		this.#lock = fifoLock(this.#db);
	}

	async acquireConnection(): Promise<PGlite> {
		await this.#db.waitReady;
		return this.#lock.acquire();
	}

	releaseConnection(_connection: PGlite): void {
		this.#lock.release();
	}

	async run({
		connection,
		sql,
		params,
	}: DatabaseAdapterRunOptions<PGlite>): Promise<StatementResult> {
		try {
			const result = await connection.query(sql, params);
			return {
				rows: result.rows as Row[],
				rowsAffected: result.rows.length > 0 ? result.rows.length : (result.affectedRows ?? 0),
			};
		} catch (error) {
			throw makeQueryError(sql, error);
		}
	}

	async batch({
		queries,
		connection,
	}: DatabaseAdapterBatchOptions<PGlite>): Promise<StatementResult[]> {
		const results: StatementResult[] = [];
		for (const query of queries) {
			results.push(await this.run({ ...query, connection }));
		}
		return results;
	}

	dispose(): void {
		void this.#db.close();
	}
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
