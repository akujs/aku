import { BaseClass } from "../../utils.ts";
import type { TransactionOptions } from "../DatabaseClient.ts";

export type TransactionBeginOptions = Pick<TransactionOptions, "isolation" | "sqliteMode">;

/**
 * Base class for database grammars used to generate SQL statements.
 * Database-specific grammars subclass this and override methods to
 * generate SQL for specific databases.
 */
export abstract class DatabaseGrammar extends BaseClass {
	transactionBegin(_options?: TransactionBeginOptions): string {
		return "BEGIN";
	}

	transactionCommit(): string {
		return "COMMIT";
	}

	transactionRollback(): string {
		return "ROLLBACK";
	}

	savepointCreate(name: string): string {
		return `SAVEPOINT ${name}`;
	}

	savepointRelease(name: string): string {
		return `RELEASE SAVEPOINT ${name}`;
	}

	savepointRollback(name: string): string {
		return `ROLLBACK TO SAVEPOINT ${name}`;
	}
}
