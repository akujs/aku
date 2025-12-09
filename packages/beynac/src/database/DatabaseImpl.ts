import { abort } from "../http/abort.ts";
import { BaseClass } from "../utils.ts";
import type { Database, Row, Statement, StatementResult } from "./contracts/Database.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import { DatabaseError, QueryError } from "./database-errors.ts";
import { renderStatementForLogs } from "./sql.ts";

export class DatabaseImpl extends BaseClass implements Database {
	readonly #adapter: DatabaseAdapter;
	readonly supportsTransactions: boolean;

	constructor(adapter: DatabaseAdapter) {
		super();
		this.#adapter = adapter;
		this.supportsTransactions = typeof adapter.transaction === "function";
	}

	run(statement: Statement): Promise<StatementResult> {
		return this.#adapter.run(statement);
	}

	batch(statements: Statement[]): Promise<StatementResult[]> {
		return this.#adapter.batch(statements);
	}

	transaction<T>(fn: () => Promise<T>): Promise<T> {
		if (!this.#adapter.transaction) {
			throw new DatabaseError(
				"This database adapter does not support interactive transactions. Use batch() instead.",
			);
		}
		return this.#adapter.transaction(fn);
	}

	dispose(): void | Promise<void> {
		return this.#adapter.dispose();
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
			throw new QueryError(renderStatementForLogs(statement), "Query returned no rows", undefined);
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
