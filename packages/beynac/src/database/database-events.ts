import { BeynacEvent } from "../core/core-events.ts";
import type { Statement, StatementResult } from "./contracts/Database.ts";

/**
 * Operation types for database events
 */
export type DatabaseOperationType =
	| "query"
	| "transaction:begin"
	| "transaction:commit"
	| "transaction:rollback";

/**
 * Transaction context included in all database events
 */
export interface TransactionContext {
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
}

/**
 * Base class for all database events
 */
export abstract class DatabaseEvent extends BeynacEvent {
	abstract readonly type: DatabaseOperationType;

	constructor(public readonly context: TransactionContext) {
		super();
	}

	get transactionId(): number | null {
		return this.context.transactionId;
	}

	get outerTransactionId(): number | null {
		return this.context.outerTransactionId;
	}

	get transactionDepth(): number {
		return this.context.transactionDepth;
	}
}

/**
 * Base class for "starting" database operation events
 */
export abstract class DatabaseOperationStartingEvent extends DatabaseEvent {
	readonly phase = "start" as const;
	public readonly startTimestamp: number = Date.now();
}

/**
 * Base class for "completed" database operation events
 */
export abstract class DatabaseOperationCompletedEvent extends DatabaseEvent {
	readonly phase = "complete" as const;
	public readonly timeTakenMs: number;

	constructor(startEvent: DatabaseOperationStartingEvent) {
		super(startEvent.context);
		this.timeTakenMs = Date.now() - startEvent.startTimestamp;
	}
}

// ============================================================================
// Query Events
// ============================================================================

/** Dispatched before a query is executed. */
export class QueryExecutingEvent extends DatabaseOperationStartingEvent {
	public readonly type = "query" as const;

	constructor(
		context: TransactionContext,
		public readonly statement: Statement,
	) {
		super(context);
	}
}

/** Dispatched after a query has been successfully executed. */
export class QueryExecutedEvent extends DatabaseOperationCompletedEvent {
	public readonly type = "query" as const;
	readonly #startEvent: QueryExecutingEvent;

	constructor(
		startEvent: QueryExecutingEvent,
		public readonly result: StatementResult,
	) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get statement(): Statement {
		return this.#startEvent.statement;
	}
}

/** Dispatched when a query fails. */
export class QueryFailedEvent extends DatabaseEvent {
	readonly phase = "fail" as const;
	public readonly type = "query" as const;
	public readonly timeTakenMs: number;
	readonly #startEvent: QueryExecutingEvent;

	constructor(
		startEvent: QueryExecutingEvent,
		public readonly error: unknown,
	) {
		super(startEvent.context);
		this.timeTakenMs = Date.now() - startEvent.startTimestamp;
		this.#startEvent = startEvent;
	}

	get statement(): Statement {
		return this.#startEvent.statement;
	}
}

// ============================================================================
// Transaction Events
// ============================================================================

/**
 * Transaction context for transaction events.
 * Unlike query events, the context here refers to the transaction being
 * created/destroyed, not the parent context.
 */
export interface TransactionEventContext extends TransactionContext {
	/**
	 * The ID of the transaction being created/committed/rolled back.
	 */
	readonly transactionId: number;
}

/** Dispatched before a transaction begins (before BEGIN or SAVEPOINT). */
export class TransactionBeginningEvent extends DatabaseOperationStartingEvent {
	public readonly type = "transaction:begin" as const;
	public override readonly context: TransactionEventContext;

	constructor(context: TransactionEventContext) {
		super(context);
		this.context = context;
	}
}

/** Dispatched before a transaction commits (before COMMIT or RELEASE SAVEPOINT). */
export class TransactionCommittingEvent extends DatabaseOperationStartingEvent {
	public readonly type = "transaction:commit" as const;
	public override readonly context: TransactionEventContext;

	constructor(context: TransactionEventContext) {
		super(context);
		this.context = context;
	}
}

/** Dispatched after a transaction has been successfully committed. */
export class TransactionCommittedEvent extends DatabaseOperationCompletedEvent {
	public readonly type = "transaction:commit" as const;
	public override readonly context: TransactionEventContext;

	constructor(startEvent: TransactionCommittingEvent) {
		super(startEvent);
		this.context = startEvent.context;
	}
}

/** Dispatched after a transaction has been rolled back. */
export class TransactionRolledBackEvent extends DatabaseEvent {
	readonly phase = "fail" as const;
	public readonly type = "transaction:rollback" as const;
	public override readonly context: TransactionEventContext;
	public readonly timeTakenMs: number;

	constructor(
		beginEvent: TransactionBeginningEvent,
		public readonly error: unknown,
	) {
		super(beginEvent.context);
		this.context = beginEvent.context;
		this.timeTakenMs = Date.now() - beginEvent.startTimestamp;
	}
}
