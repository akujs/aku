import type { SharedTestConfig } from "../../database-test-utils.ts";
import { PGLiteDatabase, pgliteDatabase } from "./PGLiteDatabase.ts";

export const pgLiteSharedTestConfig: SharedTestConfig = {
	name: PGLiteDatabase.name,
	createDatabase: () => pgliteDatabase(),
	supportsTransactions: true,
};
