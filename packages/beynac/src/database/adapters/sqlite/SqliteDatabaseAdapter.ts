import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BaseClass, type FifoLock, fifoLock } from "../../../utils.ts";
import type { Statement, StatementResult } from "../../contracts/Database.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { QueryError } from "../../database-errors.ts";
import type { SqliteDatabaseAdapterConfig } from "./SqliteDatabaseAdapterConfig.ts";
import type { SqliteConnection, SqliteOps } from "./SqliteOps.ts";

export class SqliteDatabaseAdapter extends BaseClass implements DatabaseAdapter<SqliteConnection> {
	readonly supportsTransactions = true;

	readonly #useWalMode: boolean;
	readonly #path: string;
	readonly #readOnly: boolean;
	readonly #create: boolean;
	readonly #isMemory: boolean;

	#mainConnection: SqliteConnection | null = null;
	#mainConnectionInUse = false;
	#mainConnectionLock: FifoLock<SqliteConnection> | null = null;
	#sqliteOps: SqliteOps | null = null;

	constructor(config: SqliteDatabaseAdapterConfig) {
		super();

		this.#isMemory = config.path === ":memory:";
		const shouldCreate = config.create !== false;

		this.#useWalMode = !this.#isMemory && config.useWalMode !== false;
		this.#path = config.path;
		this.#readOnly = config.readOnly ?? false;
		this.#create = !this.#readOnly && config.create !== false;

		if (!this.#isMemory) {
			if (shouldCreate) {
				mkdirSync(dirname(config.path), { recursive: true });
			} else if (!existsSync(config.path)) {
				throw new Error(`Database file does not exist: ${config.path}`);
			}
		} else if (config.readOnly) {
			throw new Error("In-memory databases can't be read-only");
		}
	}

	async acquireConnection(): Promise<SqliteConnection> {
		if (this.#isMemory) {
			// Memory databases share a single connection with exclusive access
			const lock = await this.#getMainConnectionLock();
			return lock.acquire();
		}

		// File-based databases: try to use main connection, otherwise create overflow
		if (!this.#mainConnection) {
			this.#mainConnection = await this.#createConnection();
			if (this.#useWalMode) {
				this.#mainConnection.exec("PRAGMA journal_mode=WAL");
			}
		}

		// For file-based SQLite with WAL mode, we can use multiple connections.
		// Prefer the main connection for efficiency, create overflow connections
		// only when the main connection is already in use.
		if (!this.#mainConnectionInUse) {
			this.#mainConnectionInUse = true;
			return this.#mainConnection;
		}

		// Main connection is in use, create an overflow connection
		return this.#createConnection();
	}

	releaseConnection(connection: SqliteConnection): void {
		if (this.#isMemory) {
			// Memory databases use the lock - release it
			this.#mainConnectionLock?.release();
		} else if (connection === this.#mainConnection) {
			// Releasing main connection - mark it as available
			this.#mainConnectionInUse = false;
		} else {
			// Overflow connection - close it
			connection.close();
		}
	}

	async run(statement: Statement, connection: SqliteConnection): Promise<StatementResult> {
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
	}

	async batch(statements: Statement[], connection: SqliteConnection): Promise<StatementResult[]> {
		const results: StatementResult[] = [];
		for (const stmt of statements) {
			results.push(await this.run(stmt, connection));
		}
		return results;
	}

	async #getMainConnectionLock(): Promise<FifoLock<SqliteConnection>> {
		if (!this.#mainConnectionLock) {
			const connection = await this.#createConnection();
			this.#mainConnection = connection;
			this.#mainConnectionLock = fifoLock(connection);
		}
		return this.#mainConnectionLock;
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

	dispose(): void {
		this.#mainConnection?.close();
		this.#mainConnection = null;
		this.#mainConnectionLock = null;
	}
}

interface PlatformError {
	// Bun uses 'errno'
	errno?: number;
	// Node.js uses 'errcode'
	errcode?: number;
	message?: string;
}

function toSql(statement: Statement): string {
	return statement.renderSql(() => "?");
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
