import { getFacadeApplication } from "../core/facade.ts";
import type { DatabaseClient } from "./DatabaseClient.ts";
import type { ExecutableStatement } from "./ExecutableStatement.ts";
import type { Row, StatementResult } from "./Statement.ts";
import { StatementImpl } from "./StatementImpl.ts";

export class ExecutableStatementImpl extends StatementImpl implements ExecutableStatement {
	readonly #clientName: string | undefined;

	constructor(
		strings: TemplateStringsArray | readonly string[],
		values: unknown[],
		clientName?: string,
	) {
		super(strings, values);
		this.#clientName = clientName;
	}

	on(clientName: string): ExecutableStatement {
		return new ExecutableStatementImpl(this.fragments, this.params, clientName);
	}

	run(): Promise<StatementResult> {
		return this.#getClient().run(this);
	}

	all<T = Row>(): Promise<T[]> {
		return this.#getClient().all<T>(this);
	}

	first<T = Row>(): Promise<T> {
		return this.#getClient().first<T>(this);
	}

	firstOrNull<T = Row>(): Promise<T | null> {
		return this.#getClient().firstOrNull<T>(this);
	}

	firstOrFail<T = Row>(): Promise<T> {
		return this.#getClient().firstOrFail<T>(this);
	}

	firstOrNotFound<T = Row>(): Promise<T> {
		return this.#getClient().firstOrNotFound<T>(this);
	}

	scalar<T = unknown>(): Promise<T> {
		return this.#getClient().scalar<T>(this);
	}

	column<T = unknown>(): Promise<T[]> {
		return this.#getClient().column<T>(this);
	}

	// oxlint-disable-next-line unicorn/no-thenable -- intentionally thenable so `await sql`...`` works
	then: ExecutableStatement["then"] = (onfulfilled, onrejected) => {
		return this.all().then(onfulfilled, onrejected);
	};

	#getClient(): DatabaseClient {
		const app = getFacadeApplication();
		return app.database.client(this.#clientName);
	}
}
