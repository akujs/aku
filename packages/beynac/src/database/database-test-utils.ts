import type { Database } from "./contracts/Database.ts";

export type SharedTestConfig = {
	name: string;
	createDatabase: () => Database | Promise<Database>;
	supportsTransactions?: boolean | undefined;
};
