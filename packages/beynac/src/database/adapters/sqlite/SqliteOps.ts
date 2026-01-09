import type { Row } from "../../query-types.ts";

export interface SqlitePreparedStatement {
	readonly isQuery: boolean;
	all(...params: unknown[]): Row[];
	run(...params: unknown[]): { changes: number };
}

export interface SqliteConnection {
	prepare(sql: string): SqlitePreparedStatement;
	exec(sql: string): void;
	close(): void;
}

export interface SqliteConnectionOptions {
	readonly?: boolean;
	create?: boolean;
}

export interface SqliteOps {
	createConnection(path: string, options: SqliteConnectionOptions): SqliteConnection;
}
