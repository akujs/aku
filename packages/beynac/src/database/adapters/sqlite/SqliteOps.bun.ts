// Bun-specific SQLite operations using bun:sqlite.
import { Database, type SQLQueryBindings } from "bun:sqlite";
import type {
	SqliteConnection,
	SqliteConnectionOptions,
	SqliteOps,
	SqlitePreparedStatement,
} from "./SqliteOps.ts";

class BunPreparedStatement implements SqlitePreparedStatement {
	readonly #stmt: ReturnType<Database["prepare"]>;

	constructor(stmt: ReturnType<Database["prepare"]>) {
		this.#stmt = stmt;
	}

	all(...params: unknown[]): Record<string, unknown>[] {
		return this.#stmt.all(...(params as SQLQueryBindings[])) as Record<string, unknown>[];
	}

	run(...params: unknown[]): { changes: number } {
		const result = this.#stmt.run(...(params as SQLQueryBindings[]));
		return { changes: result.changes };
	}

	get isQuery(): boolean {
		return this.#stmt.columnNames.length > 0;
	}
}

class BunConnection implements SqliteConnection {
	readonly #db: Database;

	constructor(db: Database) {
		this.#db = db;
	}

	prepare(sql: string): SqlitePreparedStatement {
		const stmt = this.#db.prepare(sql);
		return new BunPreparedStatement(stmt);
	}

	exec(sql: string): void {
		this.#db.exec(sql);
	}

	close(): void {
		this.#db.close();
	}
}

export const sqliteOps: SqliteOps = {
	createConnection(path: string, options: SqliteConnectionOptions): SqliteConnection {
		const db = new Database(path, {
			strict: true,
			readonly: options.readonly ?? false,
			create: options.create ?? true,
		});
		return new BunConnection(db);
	},
};
