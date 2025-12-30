import type { DatabaseClient } from "./DatabaseClient.ts";
import type { Row, StatementResult } from "./query-types.ts";
import { StatementImpl } from "./StatementImpl.ts";

export abstract class ExecutableStatementBase extends StatementImpl {
	protected abstract getClient(): DatabaseClient;

	// oxlint-disable-next-line unicorn/no-thenable -- intentionally awaitable API
	abstract then: Promise<unknown>["then"];

	abstract withPrepare(value?: boolean): this;

	run(): Promise<StatementResult> {
		return this.getClient().run(this);
	}

	all<T = Row>(): Promise<T[]> {
		return this.getClient().all<T>(this);
	}

	first<T = Row>(): Promise<T> {
		return this.getClient().first<T>(this);
	}

	firstOrNull<T = Row>(): Promise<T | null> {
		return this.getClient().firstOrNull<T>(this);
	}

	firstOrFail<T = Row>(): Promise<T> {
		return this.getClient().firstOrFail<T>(this);
	}

	firstOrNotFound<T = Row>(): Promise<T> {
		return this.getClient().firstOrNotFound<T>(this);
	}

	scalar<T = unknown>(): Promise<T> {
		return this.getClient().scalar<T>(this);
	}

	column<T = unknown>(): Promise<T[]> {
		return this.getClient().column<T>(this);
	}
}
