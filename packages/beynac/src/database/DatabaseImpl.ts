import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { BaseClass } from "../utils.ts";
import type {
	Database,
	DatabaseClient,
	Row,
	Statement,
	StatementResult,
} from "./contracts/Database.ts";
import type { DatabaseAdapter, DatabaseConfig } from "./DatabaseAdapter.ts";
import type { TransactionOptions } from "./DatabaseClient.ts";
import { DatabaseClientImpl } from "./DatabaseClientImpl.ts";
import { ClientNotFoundError } from "./database-errors.ts";

const DEFAULT_CLIENT_NAME = "default";

export class DatabaseImpl extends BaseClass implements Database {
	readonly #defaultClient: DatabaseClientImpl;
	readonly #additionalClients: Map<string, DatabaseClientImpl> = new Map();

	constructor(config: DatabaseAdapter | DatabaseConfig, dispatcher: Dispatcher) {
		super();
		if (isAdapter(config)) {
			this.#defaultClient = new DatabaseClientImpl(config, dispatcher);
		} else {
			this.#defaultClient = new DatabaseClientImpl(config.default, dispatcher);
			for (const [name, adapter] of Object.entries(config.additional ?? {})) {
				this.#additionalClients.set(name, new DatabaseClientImpl(adapter, dispatcher));
			}
		}
	}

	client(name?: string): DatabaseClient {
		if (name === undefined || name === DEFAULT_CLIENT_NAME) {
			return this.#defaultClient;
		}
		const conn = this.#additionalClients.get(name);
		if (!conn) {
			throw new ClientNotFoundError(name);
		}
		return conn;
	}

	get supportsTransactions(): boolean {
		return this.#defaultClient.supportsTransactions;
	}

	get transactionId(): number | null {
		return this.#defaultClient.transactionId;
	}

	get outerTransactionId(): number | null {
		return this.#defaultClient.outerTransactionId;
	}

	get transactionDepth(): number {
		return this.#defaultClient.transactionDepth;
	}

	run(statement: Statement): Promise<StatementResult> {
		return this.#defaultClient.run(statement);
	}

	batch(statements: Statement[]): Promise<StatementResult[]> {
		return this.#defaultClient.batch(statements);
	}

	transaction<T>(fn: () => Promise<T>, options?: TransactionOptions): Promise<T> {
		return this.#defaultClient.transaction(fn, options);
	}

	dispose(): void {
		this.#defaultClient.dispose();
		for (const conn of this.#additionalClients.values()) {
			conn.dispose();
		}
	}

	all<T = Row>(statement: Statement): Promise<T[]> {
		return this.#defaultClient.all<T>(statement);
	}

	first<T = Row>(statement: Statement): Promise<T> {
		return this.#defaultClient.first<T>(statement);
	}

	firstOrNull<T = Row>(statement: Statement): Promise<T | null> {
		return this.#defaultClient.firstOrNull<T>(statement);
	}

	firstOrFail<T = Row>(statement: Statement): Promise<T> {
		return this.#defaultClient.firstOrFail<T>(statement);
	}

	firstOrNotFound<T = Row>(statement: Statement): Promise<T> {
		return this.#defaultClient.firstOrNotFound<T>(statement);
	}

	scalar<T = unknown>(statement: Statement): Promise<T> {
		return this.#defaultClient.scalar<T>(statement);
	}

	column<T = unknown>(statement: Statement): Promise<T[]> {
		return this.#defaultClient.column<T>(statement);
	}
}

function isAdapter(value: DatabaseAdapter | DatabaseConfig): value is DatabaseAdapter {
	return typeof (value as DatabaseAdapter).acquireConnection === "function";
}
