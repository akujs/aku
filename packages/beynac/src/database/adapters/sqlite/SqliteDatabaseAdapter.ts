import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BaseClass, exclusiveRunner, parallelRunner, type Runner } from "../../../utils.ts";
import type { Statement, StatementResult } from "../../contracts/Database.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import { renderStatementSql } from "../../sql.ts";
import type { SqliteDatabaseAdapterConfig } from "./SqliteDatabaseAdapterConfig.ts";
import type { SqliteConnection, SqliteOps } from "./SqliteOps.ts";

export class SqliteDatabaseAdapter extends BaseClass implements DatabaseAdapter {
	readonly #connectionStorage = new AsyncLocalStorage<ConnectionContext>();
	readonly #connectionRunner: Runner;
	readonly #useWalMode: boolean;
	readonly #path: string;
	readonly #readOnly: boolean;
	readonly #create: boolean;
	#mainConnection: SqliteConnection | null = null;
	#mainConnectionInUse = false;
	#sqliteOps: SqliteOps | null = null;

	constructor(config: SqliteDatabaseAdapterConfig) {
		super();

		const isMemory = config.path === ":memory:";
		const shouldCreate = config.create !== false;

		this.#connectionRunner = isMemory ? exclusiveRunner() : parallelRunner();
		this.#useWalMode = !isMemory && config.useWalMode !== false;
		this.#path = config.path;
		this.#readOnly = config.readOnly ?? false;
		this.#create = !this.#readOnly && config.create !== false;

		if (!isMemory) {
			if (shouldCreate) {
				mkdirSync(dirname(config.path), { recursive: true });
			} else if (!existsSync(config.path)) {
				throw new Error(`Database file does not exist: ${config.path}`);
			}
		} else if (config.readOnly) {
			throw new Error("In-memory databases can't be read-only");
		}
	}

	async run(statement: Statement): Promise<StatementResult> {
		return this.#withConnection(async ({ connection }): Promise<StatementResult> => {
			const sqlString = toSql(statement);
			try {
				const prepared = connection.prepare(sqlString);

				if (prepared.isQuery) {
					const rows = prepared.all(...statement.params);
					return { rows, rowsAffected: rows.length };
				}
				const result = prepared.run(...statement.params);
				return { rows: [], rowsAffected: result.changes };
			} catch (error) {
				throw makeQueryError(sqlString, error);
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

			this.#exec(begin, ctx.connection);
			try {
				++ctx.depth;
				const result = await fn();
				this.#exec(commit, ctx.connection);
				return result;
			} catch (error) {
				this.#exec(rollback, ctx.connection);
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
			let connection: SqliteConnection | undefined;
			let useMainConnection = !this.#mainConnectionInUse;

			try {
				if (useMainConnection) {
					this.#mainConnectionInUse = true;
					connection = await this.#getMainConnection();
				} else {
					connection = await this.#createConnection();
				}
				const ctx: ConnectionContext = { connection, depth: 0 };
				return await this.#connectionStorage.run(ctx, () => f(ctx));
			} finally {
				if (useMainConnection) {
					this.#mainConnectionInUse = false;
				} else {
					connection?.close();
				}
			}
		});
	}

	async #getMainConnection(): Promise<SqliteConnection> {
		if (!this.#mainConnection) {
			this.#mainConnection = await this.#createConnection();
			if (this.#useWalMode !== false) {
				this.#mainConnection.exec("PRAGMA journal_mode=WAL");
			}
		}
		return this.#mainConnection;
	}

	async #getSqliteOps(): Promise<SqliteOps> {
		if (!this.#sqliteOps) {
			if ("bun" in globalThis.process.versions) {
				const { sqliteOps } = await import("./SqliteOps.bun.ts" as string);
				this.#sqliteOps = sqliteOps as SqliteOps;
			} else {
				const { sqliteOps } = await import("./SqliteOps.node.ts" as string);
				this.#sqliteOps = sqliteOps as SqliteOps;
			}
		}
		return this.#sqliteOps;
	}

	async #createConnection(): Promise<SqliteConnection> {
		const ops = await this.#getSqliteOps();
		return ops.createConnection(this.#path, {
			readonly: this.#readOnly,
			create: this.#create,
		});
	}

	#exec(sql: string, connection: SqliteConnection): void {
		try {
			connection.exec(sql);
		} catch (error) {
			throw makeQueryError(sql, error);
		}
	}

	dispose(): void {
		this.#mainConnection?.close();
		this.#mainConnection = null;
	}
}

interface ConnectionContext {
	connection: SqliteConnection;
	depth: number; // 0 = no transaction, 1+ = in transaction (depth indicates nesting level)
}

interface PlatformError {
	// Bun uses 'errno'
	errno?: number;
	// Node.js uses 'errcode'
	errcode?: number;
	message?: string;
}

function toSql(statement: Statement): string {
	return renderStatementSql(statement, () => "?");
}

function makeQueryError(sql: string, cause: unknown): QueryError {
	const error = cause as PlatformError;

	const errorNumber = error.errno ?? error.errcode;
	let code: string | undefined;
	let message: string | undefined;

	if (errorNumber !== undefined) {
		// Primary code is in lower 8 bits
		const primaryCode = errorNumber & 0xff;
		const info = sqliteErrorCodes.get(primaryCode);
		if (info) {
			code = info[0];
			message = info[1];
		}
	}

	message ??= error.message ?? String(error);

	if (code) {
		message = `${code} (${message})`;
	}

	return new QueryError(sql, message ?? error.message ?? String(error), error, code, errorNumber);
}

const sqliteErrorCodes = new Map<number, [string, string]>([
	[1, ["SQLITE_ERROR", "Generic error"]],
	[2, ["SQLITE_INTERNAL", "Internal logic error in SQLite"]],
	[3, ["SQLITE_PERM", "Access permission denied"]],
	[4, ["SQLITE_ABORT", "Callback routine requested an abort"]],
	[5, ["SQLITE_BUSY", "The database file is locked"]],
	[6, ["SQLITE_LOCKED", "A table in the database is locked"]],
	[7, ["SQLITE_NOMEM", "A malloc() failed"]],
	[8, ["SQLITE_READONLY", "Attempt to write a readonly database"]],
	[9, ["SQLITE_INTERRUPT", "Operation terminated by sqlite3_interrupt("]],
	[10, ["SQLITE_IOERR", "Some kind of disk I/O error occurred"]],
	[11, ["SQLITE_CORRUPT", "The database disk image is malformed"]],
	[12, ["SQLITE_NOTFOUND", "Unknown opcode in sqlite3_file_control()"]],
	[13, ["SQLITE_FULL", "Insertion failed because database is full"]],
	[14, ["SQLITE_CANTOPEN", "Unable to open the database file"]],
	[15, ["SQLITE_PROTOCOL", "Database lock protocol error"]],
	[16, ["SQLITE_EMPTY", "Internal use only"]],
	[17, ["SQLITE_SCHEMA", "The database schema changed"]],
	[18, ["SQLITE_TOOBIG", "String or BLOB exceeds size limit"]],
	[19, ["SQLITE_CONSTRAINT", "Abort due to constraint violation"]],
	[20, ["SQLITE_MISMATCH", "Data type mismatch"]],
	[21, ["SQLITE_MISUSE", "Library used incorrectly"]],
	[22, ["SQLITE_NOLFS", "Uses OS features not supported on host"]],
	[23, ["SQLITE_AUTH", "Authorization denied"]],
	[24, ["SQLITE_FORMAT", "Not used"]],
	[25, ["SQLITE_RANGE", "2nd parameter to sqlite3_bind out of range"]],
	[26, ["SQLITE_NOTADB", "File opened that is not a database file"]],
	[27, ["SQLITE_NOTICE", "Notifications from sqlite3_log()"]],
	[28, ["SQLITE_WARNING", "Warnings from sqlite3_log()"]],
]);
