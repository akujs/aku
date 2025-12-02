// oxlint-disable-next-line no-restricted-imports
import type { Database as BunDatabase } from "bun:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { BaseClass } from "../../../utils.ts";
import type { Database, ExecuteResult, QueryResult, Statement } from "../../contracts/Database.ts";
import { QueryError, TransactionError } from "../../database-errors.ts";

const require = createRequire(import.meta.url);

interface PreparedStatement {
	all(...params: unknown[]): Record<string, unknown>[];
	run(...params: unknown[]): { changes: number };
	// node:sqlite and better-sqlite3 use columns(), bun:sqlite uses columnNames
	columns?: () => Array<{ name: string }>;
	columnNames?: string[];
}

interface DatabaseObject {
	prepare(sql: string): PreparedStatement;
	exec(sql: string): void;
	close(): void;
}

interface TransactionContext {
	depth: number;
}

export interface SqliteDatabaseConfig {
	/**
	 * The path to the database file, or :memory: to use an in-memory database.
	 */
	path: string;

	/**
	 * If true, open the database in read-only mode.
	 */
	readOnly?: boolean;

	/**
	 * If false, disable the default behaviour of creating the database file and
	 * any missing parent directories if they don't exist.
	 *
	 * @default true
	 */
	create?: boolean;

	/**
	 * If false, disable the default behaviour of enabling write-ahead-logging
	 * (WAL) mode for the database. This is recommended for performance.
	 *
	 * @see https://sqlite.org/wal.html
	 *
	 * @default true
	 */
	useWalMode?: boolean;
}

export class SqliteDatabase extends BaseClass implements Database {
	private readonly db: DatabaseObject;
	private readonly transactionStorage = new AsyncLocalStorage<TransactionContext>();

	constructor(config: SqliteDatabaseConfig) {
		super();

		const isMemory = config.path === ":memory:";
		const shouldCreate = config.create !== false;

		// Handle file creation / existence check
		if (!isMemory) {
			if (shouldCreate) {
				mkdirSync(dirname(config.path), { recursive: true });
			} else if (!existsSync(config.path)) {
				throw new Error(`Database file does not exist: ${config.path}`);
			}
		}

		if (typeof Bun !== "undefined") {
			const Database: typeof BunDatabase = require("bun:sqlite").Database;
			this.db = new Database(config.path, {
				strict: true,
				readonly: config.readOnly ?? false,
				// Don't pass create when readonly - Bun ignores readonly if create is true
				create: config.readOnly ? false : shouldCreate,
			}) as BunDatabase;
		} else {
			const { DatabaseSync } = require("node:sqlite");
			this.db = new DatabaseSync(config.path, {
				readOnly: config.readOnly ?? false,
			}) as DatabaseObject;
		}

		// Enable WAL mode by default for file-based databases
		if (!isMemory && config.useWalMode !== false) {
			this.db.exec("PRAGMA journal_mode=WAL");
		}
	}

	async query(statement: Statement): Promise<QueryResult> {
		return Promise.resolve(this.querySync(statement));
	}

	async execute(statement: Statement): Promise<ExecuteResult> {
		return Promise.resolve(this.executeSync(statement));
	}

	async batch(statements: Statement[]): Promise<ExecuteResult[]> {
		const ctx = this.transactionStorage.getStore();

		if (ctx) {
			// Already in a transaction, just execute statements
			return Promise.resolve(statements.map((stmt) => this.executeSync(stmt)));
		}

		// Not in a transaction, wrap in one for atomicity
		return this.transaction(async () => {
			return statements.map((stmt) => this.executeSync(stmt));
		});
	}

	async transaction<T>(fn: () => Promise<T>): Promise<T> {
		const ctx = this.transactionStorage.getStore();

		if (ctx) {
			// Nested transaction - use savepoint
			return this.nestedTransaction(fn, ctx);
		}

		// Top-level transaction
		return this.topLevelTransaction(fn);
	}

	private querySync(statement: Statement): QueryResult {
		try {
			const prepared = this.db.prepare(statement.sql);
			const rows = prepared.all(...statement.params);
			const columnNames = prepared.columnNames ?? prepared.columns?.().map((c) => c.name) ?? [];
			return { columnNames, rows };
		} catch (error) {
			throw new QueryError(statement.sql, error);
		}
	}

	private executeSync(statement: Statement): ExecuteResult {
		try {
			const prepared = this.db.prepare(statement.sql);
			const result = prepared.run(...statement.params);
			return { rowsAffected: result.changes };
		} catch (error) {
			throw new QueryError(statement.sql, error);
		}
	}

	private async topLevelTransaction<T>(fn: () => Promise<T>): Promise<T> {
		try {
			this.db.exec("BEGIN");
		} catch (error) {
			throw new TransactionError("begin", error);
		}

		try {
			const result = await this.transactionStorage.run({ depth: 0 }, fn);

			try {
				this.db.exec("COMMIT");
			} catch (error) {
				throw new TransactionError("commit", error);
			}

			return result;
		} catch (error) {
			try {
				this.db.exec("ROLLBACK");
			} catch (rollbackError) {
				// Rollback failed, but we still want to throw the original error
				throw new TransactionError("rollback", rollbackError);
			}
			throw error;
		}
	}

	private async nestedTransaction<T>(
		fn: () => Promise<T>,
		parentCtx: TransactionContext,
	): Promise<T> {
		const depth = parentCtx.depth + 1;
		const savepointName = `sp_${depth}`;

		try {
			this.db.exec(`SAVEPOINT ${savepointName}`);
		} catch (error) {
			throw new TransactionError("savepoint", error);
		}

		try {
			const result = await this.transactionStorage.run({ depth }, fn);

			try {
				this.db.exec(`RELEASE SAVEPOINT ${savepointName}`);
			} catch (error) {
				throw new TransactionError("release", error);
			}

			return result;
		} catch (error) {
			try {
				this.db.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
			} catch (rollbackError) {
				throw new TransactionError("rollback", rollbackError);
			}
			throw error;
		}
	}

	close(): void {
		this.db.close();
	}
}

export function sqliteDatabase(config: SqliteDatabaseConfig): Database {
	return new SqliteDatabase(config);
}
