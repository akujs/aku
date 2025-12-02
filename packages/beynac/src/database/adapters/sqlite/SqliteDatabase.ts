// oxlint-disable-next-line no-restricted-imports
import type { Database as BunDatabase } from "bun:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { BaseClass } from "../../../utils.ts";
import type { Database, Statement, StatementResult } from "../../contracts/Database.ts";
import { QueryError } from "../../database-errors.ts";

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
	readonly #db: DatabaseObject;
	readonly #transactionStorage = new AsyncLocalStorage<TransactionContext>();

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
			this.#db = new Database(config.path, {
				strict: true,
				readonly: config.readOnly ?? false,
				create: config.readOnly ? false : shouldCreate,
			}) as BunDatabase;
		} else {
			const { DatabaseSync } = require("node:sqlite");
			this.#db = new DatabaseSync(config.path, {
				readOnly: config.readOnly ?? false,
			}) as DatabaseObject;
		}

		if (!isMemory && config.useWalMode !== false) {
			this.#db.exec("PRAGMA journal_mode=WAL");
		}
	}

	async run(statement: Statement): Promise<StatementResult> {
		return Promise.resolve(this.#runSync(statement));
	}

	async batch(statements: Statement[]): Promise<StatementResult[]> {
		return this.transaction(async () => {
			return statements.map((stmt) => this.#runSync(stmt));
		});
	}

	async transaction<T>(fn: () => Promise<T>): Promise<T> {
		const ctx = this.#transactionStorage.getStore();

		if (ctx) {
			// Nested transaction - use savepoint
			return this.#nestedTransaction(fn, ctx);
		}

		// Top-level transaction
		return this.#topLevelTransaction(fn);
	}

	#runSync(statement: Statement): StatementResult {
		try {
			const prepared = this.#db.prepare(statement.sql);
			const columnNames = prepared.columnNames ?? prepared.columns?.().map((c) => c.name) ?? [];
			const returnsData = columnNames.length > 0;

			if (returnsData) {
				const rows = prepared.all(...statement.params);
				return { columnNames, rows, rowsAffected: rows.length };
			}
			const result = prepared.run(...statement.params);
			return { columnNames: [], rows: [], rowsAffected: result.changes };
		} catch (error) {
			throw new QueryError(statement.sql, error);
		}
	}

	#execSync(sql: string): void {
		try {
			this.#db.exec(sql);
		} catch (error) {
			throw new QueryError(sql, error);
		}
	}

	async #topLevelTransaction<T>(fn: () => Promise<T>): Promise<T> {
		this.#execSync("BEGIN");
		try {
			const result = await this.#transactionStorage.run({ depth: 0 }, fn);
			this.#execSync("COMMIT");
			return result;
		} catch (error) {
			this.#execSync("ROLLBACK");
			throw error;
		}
	}

	async #nestedTransaction<T>(fn: () => Promise<T>, parentCtx: TransactionContext): Promise<T> {
		const depth = parentCtx.depth + 1;
		const savepointName = `sp_${depth}`;

		this.#execSync(`SAVEPOINT ${savepointName}`);
		try {
			const result = await this.#transactionStorage.run({ depth }, fn);
			this.#execSync(`RELEASE SAVEPOINT ${savepointName}`);
			return result;
		} catch (error) {
			this.#execSync(`ROLLBACK TO SAVEPOINT ${savepointName}`);
			throw error;
		}
	}

	close(): void {
		this.#db.close();
	}
}

export function sqliteDatabase(config: SqliteDatabaseConfig): Database {
	return new SqliteDatabase(config);
}
