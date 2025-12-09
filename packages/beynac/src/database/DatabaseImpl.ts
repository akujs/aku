import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { BaseClass } from "../utils.ts";
import type {
	Database,
	DatabaseConnection,
	Row,
	Statement,
	StatementResult,
} from "./contracts/Database.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import { DatabaseConnectionImpl } from "./DatabaseConnectionImpl.ts";
import { ConnectionNotFoundError } from "./database-errors.ts";

const DEFAULT_CONNECTION_NAME = "default";

export class DatabaseImpl extends BaseClass implements Database {
	readonly #connections: Map<string, DatabaseConnectionImpl> = new Map();
	readonly #defaultConnectionName: string;

	constructor(
		defaultAdapter: DatabaseAdapter,
		additionalAdapters: Record<string, DatabaseAdapter> = {},
		dispatcher: Dispatcher,
	) {
		super();
		this.#defaultConnectionName = DEFAULT_CONNECTION_NAME;
		this.#connections.set(
			DEFAULT_CONNECTION_NAME,
			new DatabaseConnectionImpl(defaultAdapter, dispatcher),
		);

		for (const [name, adapter] of Object.entries(additionalAdapters)) {
			this.#connections.set(name, new DatabaseConnectionImpl(adapter, dispatcher));
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

	get transactionId(): number | null {
		return this.#defaultConnection.transactionId;
	}

	get outerTransactionId(): number | null {
		return this.#defaultConnection.outerTransactionId;
	}

	get transactionDepth(): number {
		return this.#defaultConnection.transactionDepth;
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

	dispose(): void {
		for (const conn of this.#connections.values()) {
			conn.dispose();
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
