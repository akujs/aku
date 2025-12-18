import { BeynacError } from "../core/core-errors.ts";

// Error codes that indicate a concurrency error that may be resolved by retrying.
const CONCURRENCY_ERROR_CODES = ["40001", "40P01", "55P03", "SQLITE_BUSY"];

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

	/**
	 * The ID of the transaction in which this error occurred, or null if the
	 * error occurred outside a transaction.
	 */
	public transactionId: number | null = null;

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
 * Thrown when attempting to access a named database client that doesn't exist.
 */
export class ClientNotFoundError extends DatabaseError {
	readonly clientName: string;

	constructor(clientName: string) {
		super(`Database client "${clientName}" not found`);
		this.clientName = clientName;
	}
}

/**
 * Thrown when attempting to use a feature that is not supported by the
 * current database dialect.
 */
export class UnsupportedFeatureError extends DatabaseError {
	readonly feature: string;
	readonly dialect: string;

	constructor(feature: string, dialect: string) {
		super(`${dialect} does not support ${feature}`);
		this.feature = feature;
		this.dialect = dialect;
	}
}

/**
 * Thrown when a SQL query fails to execute.
 */
export class QueryError extends DatabaseError {
	/**
	 * The SQL that was executed.
	 */
	readonly sql: string;

	/**
	 * The error code from the underlying database driver if available, e.g. "SQLITE_BUSY" or "privilege_not_granted".
	 */
	readonly code: string | undefined;

	/**
	 * The error code from the underlying database driver if available. This
	 * will correspond to the code e.g. 5 (the numeric value of SQLITE_BUSY).
	 */
	readonly errorNumber?: number | undefined;

	constructor(sql: string, message: string, cause: unknown, code?: string, errorNumber?: number) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		message = `${message} (query: ${sql})`;
		super(message, error);
		this.sql = sql;
		this.code = code;
		this.errorNumber = errorNumber;
	}

	protected override getToStringExtra(): string | undefined {
		return this.code || undefined;
	}
}
