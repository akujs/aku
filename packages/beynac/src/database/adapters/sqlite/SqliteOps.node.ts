import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import type { Row } from "../../query-types.ts";
import type {
	SqliteConnection,
	SqliteConnectionOptions,
	SqliteOps,
	SqlitePreparedStatement,
} from "./SqliteOps.ts";

class NodePreparedStatement implements SqlitePreparedStatement {
	readonly #stmt: StatementSync;

	constructor(stmt: StatementSync) {
		this.#stmt = stmt;
	}

	all(...params: unknown[]): Row[] {
		return this.#stmt.all(...(params as SQLInputValue[])) as Row[];
	}

	run(...params: unknown[]): { changes: number } {
		const result = this.#stmt.run(...(params as SQLInputValue[]));
		return { changes: Number(result.changes) };
	}

	get isQuery(): boolean {
		return this.#stmt.columns().length > 0;
	}
}

class NodeConnection implements SqliteConnection {
	readonly #db: DatabaseSync;

	constructor(db: DatabaseSync) {
		this.#db = db;
	}

	prepare(sql: string): SqlitePreparedStatement {
		const stmt = this.#db.prepare(sql);
		return new NodePreparedStatement(stmt);
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
		const db = new DatabaseSync(path, {
			open: true,
			readOnly: options.readonly ?? false,
		});
		return new NodeConnection(db);
	},
};
