import { AsyncLocalStorage } from "node:async_hooks";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { type RetryOptions, withRetry } from "../helpers/async/retry.ts";
import { abort } from "../http/abort.ts";
import { BaseClass, type FifoLock, fifoLock } from "../utils.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import type { DatabaseClient, TransactionOptions } from "./DatabaseClient.ts";
import { DatabaseError, QueryError } from "./database-errors.ts";
import type { DatabaseEventInit, TransactionEventInit } from "./database-events.ts";
import {
	QueryExecutedEvent,
	QueryExecutingEvent,
	QueryFailedEvent,
	TransactionExecutedEvent,
	TransactionExecutingEvent,
	TransactionFailedEvent,
	TransactionPreCommitEvent,
	TransactionRetryingEvent,
} from "./database-events.ts";
import type { DefaultColumnsQueryBuilder } from "./query-builder/QueryBuilder.ts";
import { QueryBuilderImpl } from "./query-builder/QueryBuilderImpl.ts";
import type { Row, Statement, StatementResult } from "./Statement.ts";
import { sql } from "./sql.ts";

let nextTransactionId = 1;

export class DatabaseClientImpl extends BaseClass implements DatabaseClient {
	readonly #adapter: DatabaseAdapter;
	readonly #dispatcher: Dispatcher;
	readonly #connectionStorage = new AsyncLocalStorage<ConnectionContext | null>();

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
			const ctx = this.#connectionStorage.getStore();
			if (ctx?.committed) {
				throw new QueryError(
					statement.renderForLogs(),
					"the transaction has already been committed - probably an asynchronous operation was started and not awaited, and ran after the transaction finished",
					undefined,
				);
			}
			if (ctx?.isRunningNestedTransaction) {
				throw new QueryError(
					statement.renderForLogs(),
					"a nested transaction is active - probably an asynchronous operation was started and not awaited, and ran after the nested transaction started",
					undefined,
				);
			}

			const startEvent = new QueryExecutingEvent(this.#getEventInit({ statement }));
			this.#dispatcher.dispatchIfHasListeners(QueryExecutingEvent, () => startEvent);

			return this.#enrichError(() => this.#adapter.run(statement, connection)).then(
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

	#getEventInit<T extends object>(extra: T): DatabaseEventInit & T {
		const store = this.#connectionStorage.getStore();
		return { ...store, ...extra };
	}

	async #enrichError<T>(fn: () => Promise<T>): Promise<T> {
		try {
			return await fn();
		} catch (error) {
			if (error instanceof DatabaseError) {
				const ctx = this.#connectionStorage.getStore();
				error.transactionId = ctx?.transactionId ?? null;
			}
			throw error;
		}
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

	async batch(statements: Statement[]): Promise<StatementResult[]> {
		if (statements.length === 0) {
			return [];
		}
		if (this.#adapter.supportsTransactions) {
			return this.transaction(() => {
				const ctx = this.#connectionStorage.getStore()!;
				return this.#enrichError(() => this.#adapter.batch(statements, ctx.connection));
			});
		} else {
			return this.#withConnection((connection) =>
				this.#enrichError(() => this.#adapter.batch(statements, connection)),
			);
		}
	}

	async transaction<T>(fn: () => Promise<T>, options?: TransactionOptions): Promise<T> {
		if (!this.#adapter.supportsTransactions) {
			throw new DatabaseError(
				"This database adapter does not support interactive transactions. Use batch() instead.",
			);
		}

		// Retry only applies to root transactions - nested transactions use savepoints
		// which cannot be meaningfully retried on concurrency errors
		const retry = this.transactionDepth > 0 ? undefined : options?.retry;
		const retryOptions: RetryOptions =
			retry === true
				? {}
				: retry === false || retry == null
					? { maxAttempts: 0 }
					: typeof retry === "number"
						? { maxAttempts: retry }
						: retry;
		let attempt = 0;
		let lastError: DatabaseError | null = null;

		return withRetry(
			async () => {
				attempt++;
				if (attempt > 1 && lastError != null) {
					const error = lastError;
					const previousTransactionId = lastError.transactionId!;
					this.#dispatcher.dispatchIfHasListeners(
						TransactionRetryingEvent,
						() =>
							new TransactionRetryingEvent(
								this.#getEventInit({ attempt, previousTransactionId, error }),
							),
					);
					lastError = null;
				}
				try {
					return await this.#executeTransaction(fn, options);
				} catch (error) {
					if (error instanceof DatabaseError) {
						lastError = error;
					}
					throw error;
				}
			},
			{
				shouldRetry: (error) => error instanceof DatabaseError && error.isConcurrencyError(),
				...retryOptions,
			},
		);
	}

	escapeTransaction<T>(fn: () => Promise<T>): Promise<T> {
		return this.#connectionStorage.run(null, fn);
	}

	async #executeTransaction<T>(fn: () => Promise<T>, options?: TransactionOptions): Promise<T> {
		return this.#withConnection(async (connection) => {
			const parentCtx = this.#connectionStorage.getStore()!;

			// Serialise sibling nested transactions. Each transaction lazily
			// creates and acquires its parent's childLock
			const siblingLock =
				parentCtx.transactionDepth > 0 ? (parentCtx.childLock ??= fifoLock(undefined)) : undefined;
			await siblingLock?.acquire();

			const depth = parentCtx.transactionDepth + 1;
			const txId = nextTransactionId++;
			const outerTxId = parentCtx.outerTransactionId ?? txId;

			const ctx: ConnectionContext = {
				connection,
				transactionDepth: depth,
				transactionId: txId,
				outerTransactionId: outerTxId,
				childLock: undefined,
				committed: false,
				isRunningNestedTransaction: false,
			};

			const txEventInit: TransactionEventInit = {
				transactionId: txId,
				outerTransactionId: outerTxId,
				transactionDepth: depth,
			};
			const grammar = this.#adapter.grammar;
			const savepointName = `sp_${depth}`;

			const execCtrl = async (sqlString: string): Promise<void> => {
				await this.#enrichError(() => this.#adapter.run(sql.raw(sqlString), connection));
			};

			try {
				if (depth > 1) {
					parentCtx.isRunningNestedTransaction = true;
				}

				// Enter the new transaction context before BEGIN so that errors
				// during BEGIN are correctly associated with this transaction
				return await this.#connectionStorage.run(ctx, async () => {
					const executingEvent = new TransactionExecutingEvent(txEventInit);
					this.#dispatcher.dispatch(executingEvent);

					await execCtrl(
						depth === 1
							? grammar.transactionBegin(options)
							: grammar.savepointCreate(savepointName),
					);

					try {
						const result = await fn();

						this.#dispatcher.dispatchIfHasListeners(
							TransactionPreCommitEvent,
							() => new TransactionPreCommitEvent(txEventInit),
						);

						await execCtrl(
							depth === 1 ? grammar.transactionCommit() : grammar.savepointRelease(savepointName),
						);

						ctx.committed = true;

						this.#dispatcher.dispatchIfHasListeners(
							TransactionExecutedEvent,
							() => new TransactionExecutedEvent(executingEvent),
						);

						return result;
					} catch (error) {
						await execCtrl(
							depth === 1
								? grammar.transactionRollback()
								: grammar.savepointRollback(savepointName),
						);

						ctx.committed = true;

						this.#dispatcher.dispatchIfHasListeners(
							TransactionFailedEvent,
							() => new TransactionFailedEvent(executingEvent, error),
						);
						throw error;
					}
				});
			} finally {
				if (depth > 1) {
					parentCtx.isRunningNestedTransaction = false;
				}
				siblingLock?.release();
			}
		});
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

	from(table: string): DefaultColumnsQueryBuilder {
		return QueryBuilderImpl.from(table, this.#adapter.grammar);
	}
}

interface ConnectionContext {
	connection: unknown;
	transactionDepth: number;
	transactionId: number | null;
	outerTransactionId: number | null;
	childLock?: FifoLock<void> | undefined;
	committed?: boolean | undefined;
	isRunningNestedTransaction?: boolean | undefined;
}
