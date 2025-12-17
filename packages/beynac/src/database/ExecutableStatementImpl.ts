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

	constructor(sqlFragments: StringOrFragment[], clientName?: string) {
		super(sqlFragments);
		this.#clientName = clientName;
	}

	on(clientName: string): ExecutableStatement {
		return new ExecutableStatementImpl([...this.sqlFragments], clientName);
	}

	protected getClient(): DatabaseClient {
		const app = getFacadeApplication();
		return app.database.client(this.#clientName);
	}

	// oxlint-disable-next-line unicorn/no-thenable -- intentionally awaitable API
	then: ExecutableStatementWithoutClient["then"] = (onfulfilled, onrejected) => {
		return this.all().then(onfulfilled, onrejected);
	};
}
