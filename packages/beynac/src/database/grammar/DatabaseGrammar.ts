import { BaseClass } from "../../utils.ts";
import type { TransactionOptions } from "../DatabaseClient.ts";
import type { SqlDialect } from "../query-builder/dialect.ts";
import type { LockOptions } from "../query-builder/QueryBuilder.ts";
import { quoteIdentifiers } from "../query-builder/quoteIdentifiers.ts";
import type { SqlFragments } from "../Statement.ts";

export type TransactionBeginOptions = Pick<TransactionOptions, "isolation" | "sqliteMode">;

/**
 * Join types supported by the query builder.
 */
export type JoinType =
	| "JOIN"
	| "INNER JOIN"
	| "LEFT JOIN"
	| "RIGHT JOIN"
	| "FULL OUTER JOIN"
	| "CROSS JOIN";

/**
 * Base class for database grammars used to generate SQL statements.
 * Database-specific grammars subclass this and override methods to
 * generate SQL for specific databases.
 */
export abstract class DatabaseGrammar extends BaseClass {
	abstract readonly dialect: SqlDialect;

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

	compileJoin(type: JoinType, clause: string): string {
		return `${type} ${clause}`;
	}

	compileLock(type: "UPDATE" | "SHARE", options?: LockOptions): string {
		const parts = ["FOR", type];
		if (options?.noWait) parts.push("NOWAIT");
		if (options?.skipLocked) parts.push("SKIP LOCKED");
		return parts.join(" ");
	}

	quoteIdentifiers(sql: string): string {
		return quoteIdentifiers(sql, this.dialect);
	}

	/**
	 * Compile a statement's fragments and params into a SQL string with appropriate placeholders.
	 */
	abstract compileStatement(statement: SqlFragments): string;
}
