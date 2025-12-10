import type { SharedTestConfig } from "../../database-test-utils.ts";
import { pgliteDatabase } from "./_pgliteDatabase.ts";
import { PGLiteDatabaseAdapter } from "./PGLiteDatabaseAdapter.ts";

export const pgLiteSharedTestConfig: SharedTestConfig = {
	name: PGLiteDatabaseAdapter.name,
	createDatabase: () => pgliteDatabase(),
	supportsTransactions: true,
};
