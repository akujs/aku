import { join } from "node:path";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { sqliteDatabase } from "./sqliteDatabase.ts";

export const sqliteMemorySharedTestConfig: SharedTestConfig = {
	name: "SqliteDatabase (memory)",
	createDatabase: () => sqliteDatabase({ path: ":memory:" }),
	supportsTransactions: true,
};

export const sqliteFileSharedTestConfig: SharedTestConfig = {
	name: "SqliteDatabase (file)",
	createDatabase: () => {
		const testDir = createTestDirectory();
		return sqliteDatabase({ path: join(testDir, "test.db") });
	},
	supportsTransactions: true,
};
