import { describe, expect, test } from "bun:test";
import { createTestApplication } from "../test-utils/http.test-utils.ts";
import { sqliteDatabase } from "./adapters/sqlite/sqliteDatabase.ts";
import { Database } from "./contracts/Database.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";

describe("Database integration", () => {
	test("database is accessible via container when configured", () => {
		const adapter = sqliteDatabase({ path: ":memory:", transactionRetry: false });
		const { app } = createTestApplication({ database: adapter });

		expect(app.container.get(Database)).toBeInstanceOf(DatabaseImpl);
		expect(app.database).toBe(app.container.get(Database));

		adapter.dispose();
	});
});
