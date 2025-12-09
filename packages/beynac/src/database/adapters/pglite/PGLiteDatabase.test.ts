import type { SharedTestConfig } from "../../database-test-utils.ts";
import { PGLiteDatabaseAdapter } from "./PGLiteDatabaseAdapter.ts";
import { pgliteDatabase } from "./pgliteDatabase.ts";

export const pgLiteSharedTestConfig: SharedTestConfig = {
	name: PGLiteDatabaseAdapter.name,
	createDatabase: () => pgliteDatabase(),
	supportsTransactions: true,
};
