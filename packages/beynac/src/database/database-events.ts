import { BeynacEvent } from "../core/core-events.ts";
import type { DatabaseError } from "./database-errors.ts";
import type { Statement, StatementResult } from "./Statement.ts";

type DatabaseEventType =
	| "query:execute"
	| "transaction:execute"
	| "transaction:pre-commit"
	| "transaction:retry";

export interface DatabaseEventInit {
	readonly transactionId?: number | null | undefined;
	readonly outerTransactionId?: number | null | undefined;
	readonly transactionDepth?: number | undefined;
}

/**
 * Base class for all database events
 */
export abstract class DatabaseEvent extends BeynacEvent {
	abstract readonly type: DatabaseEventType;

	/**
	 * The ID of the current transaction, or null if not in a transaction.
	 */
	readonly transactionId: number | null;

	/**
	 * The ID of the outermost (root) transaction, or null if not in a transaction.
	 */
	readonly outerTransactionId: number | null;

	/**
	 * The current transaction nesting depth (0 = not in transaction).
	 */
	readonly transactionDepth: number;

	constructor(init: DatabaseEventInit) {
		super();
		this.transactionId = init.transactionId ?? null;
		this.outerTransactionId = init.outerTransactionId ?? null;
		this.transactionDepth = init.transactionDepth ?? 0;
	}
}

/**
 * Base class for all "start" database operation events
 */
export abstract class DatabaseOperationStartingEvent extends DatabaseEvent {
	readonly phase = "start" as const;

	/**
	 * High-resolution timestamp from `performance.now()` when the operation started
	 */
	public readonly startTimestamp: number = performance.now();
}

/**
 * Base class for "complete" database operation events
 */
export abstract class DatabaseOperationCompletedEvent extends DatabaseEvent {
	readonly phase = "complete" as const;
	public readonly timeTakenMs: number;

	constructor(startEvent: DatabaseOperationStartingEvent) {
		super(startEvent);
		this.timeTakenMs = performance.now() - startEvent.startTimestamp;
	}
}

export interface QueryEventInit extends DatabaseEventInit {
	readonly statement: Statement;
}

/**
 * Dispatched before a query is executed
 */
export class QueryExecutingEvent extends DatabaseOperationStartingEvent {
	public readonly type = "query:execute" as const;
	readonly statement: Statement;

	constructor(init: QueryEventInit) {
		super(init);
		this.statement = init.statement;
	}
}

/**
 * Dispatched after a query has been successfully executed
 */
export class QueryExecutedEvent extends DatabaseOperationCompletedEvent {
	public readonly type = "query:execute" as const;
	readonly #startEvent: QueryExecutingEvent;
	readonly result: StatementResult;

	constructor(startEvent: QueryExecutingEvent, result: StatementResult) {
		super(startEvent);
		this.#startEvent = startEvent;
		this.result = result;
	}

	get statement(): Statement {
		return this.#startEvent.statement;
	}
}

/**
 * Dispatched when a query fails
 */
export class QueryFailedEvent extends DatabaseEvent {
	readonly phase = "fail" as const;
	public readonly type = "query:execute" as const;
	public readonly timeTakenMs: number;
	readonly statement: Statement;
	readonly error: unknown;

	constructor(startEvent: QueryExecutingEvent, error: unknown) {
		super(startEvent);
		this.timeTakenMs = performance.now() - startEvent.startTimestamp;
		this.statement = startEvent.statement;
		this.error = error;
	}
}

export interface TransactionEventInit extends DatabaseEventInit {
	readonly transactionId: number;
	readonly outerTransactionId: number;
	readonly transactionDepth: number;
}

/**
 * Dispatched before a transaction begins (before BEGIN or SAVEPOINT)
 */
export class TransactionExecutingEvent extends DatabaseOperationStartingEvent {
	public readonly type = "transaction:execute" as const;
	public override readonly transactionId: number;
	public override readonly outerTransactionId: number;
	public override readonly transactionDepth: number;

	constructor(init: TransactionEventInit) {
		super(init);
		this.transactionId = init.transactionId;
		this.outerTransactionId = init.outerTransactionId;
		this.transactionDepth = init.transactionDepth;
	}
}

/**
 * Dispatched before a transaction commits
 *
 * You can abort the transaction by throwing an error from this event handler.
 * To prevent this from resulting in an error 500 for the current request, your
 * application code will need to catch the error.
 */
export class TransactionPreCommitEvent extends DatabaseEvent {
	public readonly type = "transaction:pre-commit" as const;
	public override readonly transactionId: number;
	public override readonly outerTransactionId: number;
	public override readonly transactionDepth: number;

	constructor(init: TransactionEventInit) {
		super(init);
		this.transactionId = init.transactionId;
		this.outerTransactionId = init.outerTransactionId;
		this.transactionDepth = init.transactionDepth;
	}
}

/**
 * Dispatched after a transaction has been successfully committed
 */
export class TransactionExecutedEvent extends DatabaseOperationCompletedEvent {
	public readonly type = "transaction:execute" as const;
	public override readonly transactionId: number;
	public override readonly outerTransactionId: number;
	public override readonly transactionDepth: number;

	constructor(executingEvent: TransactionExecutingEvent) {
		super(executingEvent);
		this.transactionId = executingEvent.transactionId;
		this.outerTransactionId = executingEvent.outerTransactionId;
		this.transactionDepth = executingEvent.transactionDepth;
	}
}

/**
 * Dispatched when a transaction fails and is rolled back
 */
export class TransactionFailedEvent extends DatabaseEvent {
	readonly phase = "fail" as const;
	public readonly type = "transaction:execute" as const;
	public override readonly transactionId: number;
	public override readonly outerTransactionId: number;
	public override readonly transactionDepth: number;
	public readonly timeTakenMs: number;
	readonly error: unknown;

	constructor(executingEvent: TransactionExecutingEvent, error: unknown) {
		super(executingEvent);
		this.transactionId = executingEvent.transactionId;
		this.outerTransactionId = executingEvent.outerTransactionId;
		this.transactionDepth = executingEvent.transactionDepth;
		this.timeTakenMs = performance.now() - executingEvent.startTimestamp;
		this.error = error;
	}
}

export interface TransactionRetryEventInit extends DatabaseEventInit {
	readonly attempt: number;
	readonly previousTransactionId: number;
	readonly error: DatabaseError;
}

/**
 * Dispatched when a transaction is about to be retried after a concurrency
 * error
 *
 * NOTE: This event is dispatched after the previous attempt failed and before
 * the next attempt started therefore the `transactionId` of the event will
 * be null.
 */
export class TransactionRetryingEvent extends DatabaseEvent {
	public readonly type = "transaction:retry" as const;

	/**
	 * Which attempt is about to start (2 for first retry, 3 for second, etc.)
	 */
	readonly attempt: number;

	/**
	 * The transactionId of the attempt that just failed and is being retried
	 */
	readonly previousTransactionId: number;

	/**
	 * The concurrency error that triggered the retry
	 */
	readonly error: DatabaseError;

	constructor(init: TransactionRetryEventInit) {
		super(init);
		this.attempt = init.attempt;
		this.previousTransactionId = init.previousTransactionId;
		this.error = init.error;
	}
}
