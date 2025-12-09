import { BeynacError } from "../core/core-errors.ts";

/**
 * Base class for all database-related errors
 */
export class DatabaseError extends BeynacError {
	public override readonly cause?: Error | undefined;

	constructor(message: string, cause?: Error) {
		super(message);
		this.cause = cause;
	}
}

/**
 * Thrown when attempting to access a database connection that doesn't exist.
 */
export class ConnectionNotFoundError extends DatabaseError {
	constructor(public readonly connectionName: string) {
		super(`Database connection "${connectionName}" not found`);
	}
}

/**
 * Thrown when a SQL query fails to execute.
 */
export class QueryError extends DatabaseError {
	/**
	 * The error code from the underlying database driver if available, e.g. "SQLITE_BUSY" or "privilege_not_granted".
	 */
	public readonly code: string | undefined;

	/**
	 * The error code from the underlying database driver if available. This
	 * will correspond to the code e.g. 5 (the numeric value of SQLITE_BUSY) or
	 * 01007 (the numeric value of privilege_not_granted in Postgres).
	 */
	public readonly errorNumber?: number | undefined;

	constructor(
		public readonly sql: string,
		message: string,
		cause: unknown,
		code?: string,
		errorNumber?: number,
	) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		super(message, error);
		this.code = code;
		this.errorNumber = errorNumber;
	}
}
