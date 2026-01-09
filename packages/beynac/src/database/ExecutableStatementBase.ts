import type { DatabaseClient } from "./DatabaseClient.ts";
import type { Row, StatementResult } from "./query-types.ts";
import { StatementImpl } from "./StatementImpl.ts";

export abstract class ExecutableStatementBase extends StatementImpl {
	protected abstract getClient(): DatabaseClient;

	abstract get(): Promise<unknown>;

	abstract withPrepare(value?: boolean): ExecutableStatementBase;

	run(): Promise<StatementResult> {
		return this.getClient().run(this);
	}

	getAll<T = Row>(): Promise<T[]> {
		return this.getClient().getAll<T>(this);
	}

	getFirstOrNull<T = Row>(): Promise<T | null> {
		return this.getClient().getFirstOrNull<T>(this);
	}

	getFirstOrFail<T = Row>(): Promise<T> {
		return this.getClient().getFirstOrFail<T>(this);
	}

	getFirstOrNotFound<T = Row>(): Promise<T> {
		return this.getClient().getFirstOrNotFound<T>(this);
	}

	getScalar<T = unknown>(): Promise<T> {
		return this.getClient().getScalar<T>(this);
	}

	getColumn<T = unknown>(): Promise<T[]> {
		return this.getClient().getColumn<T>(this);
	}
}
