import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { SqliteDatabase, sqliteDatabase } from "./SqliteDatabase.ts";

export const sqliteSharedTestConfig: SharedTestConfig = {
	name: "SqliteDatabase",
	createDatabase: () => sqliteDatabase({ path: ":memory:" }),
};

describe("SqliteDatabase", () => {
	test("works in Node.js with node:sqlite", () => {
		const testFile = import.meta.dir + "/SqliteDatabase.node-test.ts";
		const result = Bun.spawnSync([
			"node",
			"--disable-warning=ExperimentalWarning",
			"--experimental-transform-types",
			"--experimental-sqlite",
			"--test-reporter=dot",
			testFile,
		]);
		if (result.exitCode !== 0) {
			const stderr = result.stderr.toString();
			const stdout = result.stdout.toString();
			throw new Error(`Node.js test failed with exit code ${result.exitCode}\n${stderr}${stdout}`);
		}
	});

	test("readOnly prevents writes", async () => {
		const testDir = createTestDirectory({ prefix: "sqlite-readonly-" });
		const dbPath = join(testDir, "test.db");

		// Create database and add a table
		const db1 = new SqliteDatabase({ path: dbPath });
		await db1.run({ sql: "CREATE TABLE test (id INTEGER)", params: [] });
		db1.close();

		// Reopen as read-only
		const db2 = new SqliteDatabase({ path: dbPath, readOnly: true });
		expect(db2.run({ sql: "INSERT INTO test (id) VALUES (1)", params: [] })).rejects.toThrow();
		db2.close();
	});

	test("create option creates parent directories by default", async () => {
		const testDir = createTestDirectory({ prefix: "sqlite-create-" });
		const dbPath = join(testDir, "subdir", "nested", "test.db");

		const db = new SqliteDatabase({ path: dbPath });
		await db.run({ sql: "CREATE TABLE test (id INTEGER)", params: [] });
		db.close();

		expect(existsSync(dbPath)).toBe(true);
	});

	test("create=false throws if file does not exist", () => {
		const testDir = createTestDirectory({ prefix: "sqlite-nocreate-" });
		const dbPath = join(testDir, "nonexistent.db");

		expect(() => {
			new SqliteDatabase({ path: dbPath, create: false });
		}).toThrow("Database file does not exist");
	});

	test("useWalMode enables WAL by default", async () => {
		const testDir = createTestDirectory({ prefix: "sqlite-wal-" });
		const dbPath = join(testDir, "test.db");

		const db = new SqliteDatabase({ path: dbPath });
		const result = await db.run({ sql: "PRAGMA journal_mode", params: [] });
		expect(result.rows[0].journal_mode).toBe("wal");
		db.close();
	});

	test("useWalMode=false disables WAL", async () => {
		const testDir = createTestDirectory({ prefix: "sqlite-nowal-" });
		const dbPath = join(testDir, "test.db");

		const db = new SqliteDatabase({ path: dbPath, useWalMode: false });
		const result = await db.run({ sql: "PRAGMA journal_mode", params: [] });
		expect(result.rows[0].journal_mode).toBe("delete");
		db.close();
	});
});
