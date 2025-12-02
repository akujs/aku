import { BeynacError } from "../core/core-errors.ts";

/**
 * Base class for all database-related errors
 */
export abstract class DatabaseError extends BeynacError {
	public override readonly cause?: Error | undefined;

	constructor(message: string, cause?: Error) {
		super(message);
		this.cause = cause;
	}
}

/**
 * Thrown when a SQL query fails to execute.
 */
export class QueryError extends DatabaseError {
	constructor(
		public readonly sql: string,
		cause: unknown,
	) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		super(`Query failed: ${error.message}`, error);
	}
}

/**
 * Thrown when a transaction operation fails.
 */
export class TransactionError extends DatabaseError {
	constructor(
		public readonly operation: "begin" | "commit" | "rollback" | "savepoint" | "release",
		cause: unknown,
	) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		super(`Transaction ${operation} failed: ${error.message}`, error);
	}
}
