import { getFacadeApplication } from "../core/facade.ts";
import type { DatabaseClient } from "./DatabaseClient.ts";
import { ExecutableStatementBase } from "./ExecutableStatementBase.ts";
import type {
	ExecutableStatement,
	ExecutableStatementWithoutClient,
	StringOrFragment,
} from "./query-types.ts";

export class ExecutableStatementImpl
	extends ExecutableStatementBase
	implements ExecutableStatementWithoutClient
{
	readonly #clientName: string | undefined;
	readonly #prepare: boolean | undefined;

	constructor(sqlFragments: StringOrFragment[], clientName?: string, prepare?: boolean) {
		super(sqlFragments);
		this.#clientName = clientName;
		this.#prepare = prepare;
	}

	override get prepare(): boolean | undefined {
		return this.#prepare;
	}

	on(clientName: string): ExecutableStatement {
		return new ExecutableStatementImpl([...this.sqlFragments], clientName, this.#prepare);
	}

	withPrepare(value = true): this {
		return new ExecutableStatementImpl([...this.sqlFragments], this.#clientName, value) as this;
	}

	protected getClient(): DatabaseClient {
		const app = getFacadeApplication();
		return app.database.client(this.#clientName);
	}
}
