import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import type { SqlDialect } from "./query-builder/dialect.ts";

export type SharedTestConfig = {
	name: string;
	dialect: SqlDialect;
	createDatabase: () => DatabaseAdapter | Promise<DatabaseAdapter>;
	supportsTransactions?: boolean | undefined;
};
