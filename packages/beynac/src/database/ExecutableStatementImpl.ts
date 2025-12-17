import { getFacadeApplication } from "../core/facade.ts";
import type { DatabaseClient } from "./DatabaseClient.ts";
import type {
	ExecutableStatement,
	ExecutableStatementWithoutClient,
	Row,
	StatementResult,
	StringOrFragment,
} from "./query-types.ts";
import { StatementImpl } from "./StatementImpl.ts";

export class ExecutableStatementImpl
	extends StatementImpl
	implements ExecutableStatementWithoutClient
{
	readonly #clientName: string | undefined;

	constructor(sqlFragments: StringOrFragment[], clientName?: string) {
		super(sqlFragments);
		this.#clientName = clientName;
	}

	on(clientName: string): ExecutableStatement {
		return new ExecutableStatementImpl([...this.sqlFragments], clientName);
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

	// oxlint-disable-next-line unicorn/no-thenable -- intentionally awaitable API
	then: ExecutableStatementWithoutClient["then"] = (onfulfilled, onrejected) => {
		return this.all().then(onfulfilled, onrejected);
	};

	#getClient(): DatabaseClient {
		const app = getFacadeApplication();
		return app.database.client(this.#clientName);
	}
}
