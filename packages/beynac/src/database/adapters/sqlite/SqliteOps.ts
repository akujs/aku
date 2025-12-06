// Platform-neutral interface for SQLite operations.
// Implementations are in SqliteOps.bun.ts and SqliteOps.node.ts.

export interface SqlitePreparedStatement {
	readonly isQuery: boolean;
	all(...params: unknown[]): Record<string, unknown>[];
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
