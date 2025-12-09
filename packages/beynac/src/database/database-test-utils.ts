import type { DatabaseAdapter } from "./DatabaseAdapter.ts";

export type SharedTestConfig = {
	name: string;
	createDatabase: () => DatabaseAdapter | Promise<DatabaseAdapter>;
	supportsTransactions?: boolean | undefined;
};
