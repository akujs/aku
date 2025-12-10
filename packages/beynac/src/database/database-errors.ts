import { BeynacError } from "../core/core-errors.ts";

// Error codes that indicate a concurrency error that may be resolved by retrying.
const CONCURRENCY_ERROR_CODES = ["40001", "40P01", "SQLITE_BUSY"];

// Message fragments that indicate a concurrency error. These are checked when
// the error code is not available or not recognised.
const CONCURRENCY_ERROR_MESSAGES = [
	"Deadlock found when trying to get lock",
	"deadlock detected",
	"The database file is locked",
	"database is locked",
	"database table is locked",
	"A table in the database is locked",
	"has been chosen as the deadlock victim",
	"Lock wait timeout exceeded; try restarting transaction",
	"WSREP detected deadlock/conflict and aborted the transaction. Try restarting the transaction",
];

/**
 * Base class for all database-related errors
 */
export class DatabaseError extends BeynacError {
	public override readonly cause?: Error | undefined;

	constructor(message: string, cause?: Error) {
		super(message);
		this.cause = cause;
	}

	/**
	 * Whether this error indicates a concurrency issue like a deadlock or
	 * database lock that may be resolved by retrying the transaction.
	 */
	isConcurrencyError(): boolean {
		if (this instanceof QueryError && this.code && CONCURRENCY_ERROR_CODES.includes(this.code)) {
			return true;
		}
		return CONCURRENCY_ERROR_MESSAGES.some((msg) => this.message.includes(msg));
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
	 * will correspond to the code e.g. 5 (the numeric value of SQLITE_BUSY).
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
