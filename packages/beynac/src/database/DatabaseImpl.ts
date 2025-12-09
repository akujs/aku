import { abort } from "../http/abort.ts";
import { BaseClass } from "../utils.ts";
import type {
	Database,
	DatabaseConnection,
	Row,
	Statement,
	StatementResult,
} from "./contracts/Database.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import { ConnectionNotFoundError, DatabaseError, QueryError } from "./database-errors.ts";

// Implementation of a single database connection.
export class DatabaseConnectionImpl extends BaseClass implements DatabaseConnection {
	readonly #adapter: DatabaseAdapter;
	readonly supportsTransactions: boolean;

	constructor(adapter: DatabaseAdapter) {
		super();
		this.#adapter = adapter;
		this.supportsTransactions = typeof adapter.transaction === "function";
	}

	run(statement: Statement): Promise<StatementResult> {
		return this.#adapter.run(statement);
	}

	batch(statements: Statement[]): Promise<StatementResult[]> {
		return this.#adapter.batch(statements);
	}

	transaction<T>(fn: () => Promise<T>): Promise<T> {
		if (!this.#adapter.transaction) {
			throw new DatabaseError(
				"This database adapter does not support interactive transactions. Use batch() instead.",
			);
		}
		return this.#adapter.transaction(fn);
	}

	dispose(): void | Promise<void> {
		return this.#adapter.dispose();
	}

	async all<T = Row>(statement: Statement): Promise<T[]> {
		const result = await this.run(statement);
		return result.rows as T[];
	}

	async first<T = Row>(statement: Statement): Promise<T> {
		const result = await this.run(statement);
		if (result.rows.length === 0) {
			throw new DatabaseError("Query returned no rows");
		}
		return result.rows[0] as T;
	}

	async firstOrNull<T = Row>(statement: Statement): Promise<T | null> {
		const result = await this.run(statement);
		return (result.rows[0] as T) ?? null;
	}

	async firstOrFail<T = Row>(statement: Statement): Promise<T> {
		const result = await this.run(statement);
		if (result.rows.length === 0) {
			throw new QueryError(statement.renderForLogs(), "Query returned no rows", undefined);
		}
		return result.rows[0] as T;
	}

	async firstOrNotFound<T = Row>(statement: Statement): Promise<T> {
		const result = await this.run(statement);
		if (result.rows.length === 0) {
			abort.notFound();
		}
		return result.rows[0] as T;
	}

	async scalar<T = unknown>(statement: Statement): Promise<T> {
		const firstRow = await this.firstOrFail(statement);
		return Object.values(firstRow)[0] as T;
	}

	async column<T = unknown>(statement: Statement): Promise<T[]> {
		const rows = await this.all(statement);
		return rows.map((row) => Object.values(row)[0]) as T[];
	}
}

const DEFAULT_CONNECTION_NAME = "default";

// Implementation of the Database manager that holds multiple connections.
export class DatabaseImpl extends BaseClass implements Database {
	readonly #connections: Map<string, DatabaseConnectionImpl> = new Map();
	readonly #defaultConnectionName: string;

	constructor(
		defaultAdapter: DatabaseAdapter,
		additionalAdapters: Record<string, DatabaseAdapter> = {},
	) {
		super();
		this.#defaultConnectionName = DEFAULT_CONNECTION_NAME;
		this.#connections.set(DEFAULT_CONNECTION_NAME, new DatabaseConnectionImpl(defaultAdapter));

		for (const [name, adapter] of Object.entries(additionalAdapters)) {
			this.#connections.set(name, new DatabaseConnectionImpl(adapter));
		}
	}

	connection(name?: string): DatabaseConnection {
		const connectionName = name ?? this.#defaultConnectionName;
		const conn = this.#connections.get(connectionName);
		if (!conn) {
			throw new ConnectionNotFoundError(connectionName);
		}
		return conn;
	}

	// Delegate all DatabaseConnection methods to the default connection

	get supportsTransactions(): boolean {
		return this.#defaultConnection.supportsTransactions;
	}

	get #defaultConnection(): DatabaseConnectionImpl {
		return this.#connections.get(this.#defaultConnectionName)!;
	}

	run(statement: Statement): Promise<StatementResult> {
		return this.#defaultConnection.run(statement);
	}

	batch(statements: Statement[]): Promise<StatementResult[]> {
		return this.#defaultConnection.batch(statements);
	}

	transaction<T>(fn: () => Promise<T>): Promise<T> {
		return this.#defaultConnection.transaction(fn);
	}

	dispose(): void | Promise<void> {
		const disposePromises: Promise<void>[] = [];
		for (const conn of this.#connections.values()) {
			const result = conn.dispose();
			if (result instanceof Promise) {
				disposePromises.push(result);
			}
		}
		if (disposePromises.length > 0) {
			return Promise.all(disposePromises).then(() => undefined);
		}
	}

	all<T = Row>(statement: Statement): Promise<T[]> {
		return this.#defaultConnection.all<T>(statement);
	}

	first<T = Row>(statement: Statement): Promise<T> {
		return this.#defaultConnection.first<T>(statement);
	}

	firstOrNull<T = Row>(statement: Statement): Promise<T | null> {
		return this.#defaultConnection.firstOrNull<T>(statement);
	}

	firstOrFail<T = Row>(statement: Statement): Promise<T> {
		return this.#defaultConnection.firstOrFail<T>(statement);
	}

	firstOrNotFound<T = Row>(statement: Statement): Promise<T> {
		return this.#defaultConnection.firstOrNotFound<T>(statement);
	}

	scalar<T = unknown>(statement: Statement): Promise<T> {
		return this.#defaultConnection.scalar<T>(statement);
	}

	column<T = unknown>(statement: Statement): Promise<T[]> {
		return this.#defaultConnection.column<T>(statement);
	}
}
