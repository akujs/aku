import { AsyncLocalStorage } from "node:async_hooks";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { type RetryOptions, withRetry } from "../helpers/async/retry.ts";
import { abort } from "../http/abort.ts";
import { BaseClass } from "../utils.ts";
import type { Row, Statement, StatementResult } from "./contracts/Database.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import type {
	DatabaseConnection,
	TransactionOptions,
	TransactionRetryOption,
} from "./DatabaseConnection.ts";
import { DatabaseError, QueryError } from "./database-errors.ts";
import type { TransactionContext, TransactionEventContext } from "./database-events.ts";
import {
	QueryExecutedEvent,
	QueryExecutingEvent,
	QueryFailedEvent,
	TransactionBeginningEvent,
	TransactionCommittedEvent,
	TransactionCommittingEvent,
	TransactionRolledBackEvent,
} from "./database-events.ts";
import { StatementImpl } from "./StatementImpl.ts";

let nextTransactionId = 1;

export class DatabaseConnectionImpl extends BaseClass implements DatabaseConnection {
	readonly #adapter: DatabaseAdapter;
	readonly #dispatcher: Dispatcher;
	readonly #connectionStorage = new AsyncLocalStorage<ConnectionContext>();

	constructor(adapter: DatabaseAdapter, dispatcher: Dispatcher) {
		super();
		this.#adapter = adapter;
		this.#dispatcher = dispatcher;
	}

	get supportsTransactions(): boolean {
		return this.#adapter.supportsTransactions;
	}

	get transactionId(): number | null {
		return this.#connectionStorage.getStore()?.transactionId ?? null;
	}

	get outerTransactionId(): number | null {
		return this.#connectionStorage.getStore()?.outerTransactionId ?? null;
	}

	get transactionDepth(): number {
		return this.#connectionStorage.getStore()?.transactionDepth ?? 0;
	}

	run(statement: Statement): Promise<StatementResult> {
		return this.#withConnection((connection) => {
			const context = this.#getEventContext();
			const startEvent = new QueryExecutingEvent(context, statement);
			this.#dispatcher.dispatchIfHasListeners(QueryExecutingEvent, () => startEvent);

			return this.#adapter.run(statement, connection).then(
				(result) => {
					this.#dispatcher.dispatchIfHasListeners(
						QueryExecutedEvent,
						() => new QueryExecutedEvent(startEvent, result),
					);
					return result;
				},
				(error) => {
					this.#dispatcher.dispatchIfHasListeners(
						QueryFailedEvent,
						() => new QueryFailedEvent(startEvent, error),
					);
					throw error;
				},
			);
		});
	}

	#getEventContext(): TransactionContext {
		const store = this.#connectionStorage.getStore();
		return {
			transactionId: store?.transactionId ?? null,
			outerTransactionId: store?.outerTransactionId ?? null,
			transactionDepth: store?.transactionDepth ?? 0,
		};
	}

	async #withConnection<T>(fn: (connection: unknown) => Promise<T>): Promise<T> {
		const existing = this.#connectionStorage.getStore();
		if (existing) {
			return fn(existing.connection);
		}

		const connection = await this.#adapter.acquireConnection();
		try {
			const ctx: ConnectionContext = {
				connection,
				transactionDepth: 0,
				transactionId: null,
				outerTransactionId: null,
			};
			return await this.#connectionStorage.run(ctx, () => fn(connection));
		} finally {
			this.#adapter.releaseConnection(connection);
		}
	}

	batch(statements: Statement[]): Promise<StatementResult[]> {
		if (statements.length === 0) {
			return Promise.resolve([]);
		}
		if (this.#adapter.supportsTransactions) {
			// Wrap batch in a transaction for atomicity
			return this.transaction(() => this.#runBatch(statements));
		}
		// Adapters without transaction support (e.g. D1) handle their own atomicity
		return this.#withConnection((connection) => this.#adapter.batch(statements, connection));
	}

	async #runBatch(statements: Statement[]): Promise<StatementResult[]> {
		const ctx = this.#connectionStorage.getStore()!;
		return this.#adapter.batch(statements, ctx.connection);
	}

	async transaction<T>(fn: () => Promise<T>, options?: TransactionOptions): Promise<T> {
		if (!this.#adapter.supportsTransactions) {
			throw new DatabaseError(
				"This database adapter does not support interactive transactions. Use batch() instead.",
			);
		}

		const retryOptions = normalizeRetryOptions(options?.retry);

		return withRetry(() => this.#executeTransaction(fn), {
			...retryOptions,
			shouldRetry: (error) => error instanceof DatabaseError && error.isConcurrencyError(),
		});
	}

	async #executeTransaction<T>(fn: () => Promise<T>): Promise<T> {
		return this.#withConnection(async (connection) => {
			const currentCtx = this.#connectionStorage.getStore()!;
			const depth = currentCtx.transactionDepth + 1;
			const transactionId = nextTransactionId++;
			const outerTransactionId = currentCtx.outerTransactionId ?? transactionId;

			const txEventContext: TransactionEventContext = {
				transactionId,
				outerTransactionId,
				transactionDepth: depth,
			};
			const begin = depth === 1 ? "BEGIN" : `SAVEPOINT sp_${depth}`;
			const commit = depth === 1 ? "COMMIT" : `RELEASE SAVEPOINT sp_${depth}`;
			const rollback = depth === 1 ? "ROLLBACK" : `ROLLBACK TO SAVEPOINT sp_${depth}`;

			const beginEvent = new TransactionBeginningEvent(txEventContext);
			this.#dispatcher.dispatchIfHasListeners(TransactionBeginningEvent, () => beginEvent);

			await this.#exec(begin, connection);
			try {
				const newCtx: ConnectionContext = {
					connection,
					transactionDepth: depth,
					transactionId,
					outerTransactionId,
				};
				const result = await this.#connectionStorage.run(newCtx, fn);

				const commitEvent = new TransactionCommittingEvent(txEventContext);
				this.#dispatcher.dispatchIfHasListeners(TransactionCommittingEvent, () => commitEvent);

				await this.#exec(commit, connection);

				this.#dispatcher.dispatchIfHasListeners(
					TransactionCommittedEvent,
					() => new TransactionCommittedEvent(commitEvent),
				);

				return result;
			} catch (error) {
				await this.#exec(rollback, connection);
				this.#dispatcher.dispatchIfHasListeners(
					TransactionRolledBackEvent,
					() => new TransactionRolledBackEvent(beginEvent, error),
				);
				throw error;
			}
		});
	}

	async #exec(sql: string, connection: unknown): Promise<void> {
		const statement = new StatementImpl([sql], []);
		await this.#adapter.run(statement, connection);
	}

	dispose(): void {
		this.#adapter.dispose();
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

interface ConnectionContext {
	connection: unknown;
	transactionDepth: number;
	transactionId: number | null;
	outerTransactionId: number | null;
}

function normalizeRetryOptions(retry: TransactionRetryOption | undefined): RetryOptions {
	if (retry === true) {
		return {};
	}
	if (retry === false || retry === undefined) {
		return { maxAttempts: 0 };
	}
	if (typeof retry === "number") {
		return { maxAttempts: retry };
	}
	return retry;
}
