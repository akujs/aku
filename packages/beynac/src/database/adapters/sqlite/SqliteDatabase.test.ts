import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { asyncGate } from "../../../test-utils/async-gate.ts";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { QueryError } from "../../database-errors.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { sql } from "../../sql.ts";
import { SqliteDatabase, sqliteDatabase } from "./SqliteDatabase.ts";

export const sqliteSharedTestConfig: SharedTestConfig = {
	name: SqliteDatabase.name,
	createDatabase: () => sqliteDatabase({ path: ":memory:" }),
	supportsTransactions: true,
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
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "test.db");

		const db1 = new SqliteDatabase({ path: dbPath });
		await db1.run({ sql: "CREATE TABLE test (id INTEGER)", params: [] });
		db1.close();

		const db2 = new SqliteDatabase({ path: dbPath, readOnly: true });
		expect(db2.run({ sql: "INSERT INTO test (id) VALUES (1)", params: [] })).rejects.toThrow();
		db2.close();
	});

	test("create option creates parent directories by default", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "subdir", "nested", "test.db");

		const db = new SqliteDatabase({ path: dbPath });
		await db.run({ sql: "CREATE TABLE test (id INTEGER)", params: [] });
		db.close();

		expect(existsSync(dbPath)).toBe(true);
	});

	test("create=false throws if file does not exist", () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "nonexistent.db");

		expect(() => {
			new SqliteDatabase({ path: dbPath, create: false });
		}).toThrow("Database file does not exist");
	});

	test("useWalMode enables WAL by default", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "test.db");

		const db = new SqliteDatabase({ path: dbPath });
		const result = await db.run({ sql: "PRAGMA journal_mode", params: [] });
		expect(result.rows[0].journal_mode).toBe("wal");
		db.close();
	});

	test("useWalMode=false disables WAL", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "test.db");

		const db = new SqliteDatabase({ path: dbPath, useWalMode: false });
		const result = await db.run({ sql: "PRAGMA journal_mode", params: [] });
		expect(result.rows[0].journal_mode).toBe("delete");
		db.close();
	});

	test("uncommitted transaction writes are not visible outside transaction", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "test.db");

		const db = new SqliteDatabase({ path: dbPath });
		await db.run(sql`CREATE TABLE test (value TEXT)`);

		const gate = asyncGate();

		const txPromise = db.transaction(async () => {
			await db.run(sql`INSERT INTO test (value) VALUES ('from-tx')`);
			// Transaction can see its own uncommitted write
			const insideTx = await db.run(sql`SELECT value FROM test`);
			expect(insideTx.rows).toEqual([{ value: "from-tx" }]);
			await gate.block();
		});

		await gate.hasBlocked();
		// Read outside transaction should NOT see uncommitted write (isolation)
		const outsideTx = await db.run(sql`SELECT value FROM test`);
		expect(outsideTx.rows).toEqual([]);
		gate.release();

		await txPromise;

		// After commit, the write is visible
		const afterCommit = await db.run(sql`SELECT value FROM test`);
		expect(afterCommit.rows).toEqual([{ value: "from-tx" }]);

		db.close();
	});

	test("concurrent transaction uses different connection", async () => {
		const testDir = createTestDirectory({ prefix: "sqlite-conn-" });
		const dbPath = join(testDir, "test.db");

		const db = new SqliteDatabase({ path: dbPath });
		await db.run(sql`CREATE TABLE test (value TEXT)`);
		await db.run(sql`INSERT INTO test (value) VALUES ('initial')`);

		const gate1 = asyncGate();
		const gate2 = asyncGate();

		const results: string[] = [];

		// Two concurrent read transactions - both should proceed without blocking
		const p1 = db.transaction(async () => {
			const r = await db.run(sql`SELECT value FROM test`);
			results.push(`tx1: ${String(r.rows[0].value)}`);
			await gate1.block();
		});

		const p2 = db.transaction(async () => {
			const r = await db.run(sql`SELECT value FROM test`);
			results.push(`tx2: ${String(r.rows[0].value)}`);
			await gate2.block();
		});

		await gate1.hasBlocked();
		await gate2.hasBlocked();
		gate1.release();
		gate2.release();
		await Promise.all([p1, p2]);

		// Both transactions read successfully - proves they have separate connections
		// (with a single connection, the second BEGIN would fail)
		expect(results).toContain("tx1: initial");
		expect(results).toContain("tx2: initial");

		db.close();
	});

	test("concurrent write transactions can throw SQLITE_BUSY", async () => {
		const testDir = createTestDirectory({ prefix: "sqlite-busy-" });
		const dbPath = join(testDir, "test.db");

		const db = new SqliteDatabase({ path: dbPath });
		await db.run(sql`CREATE TABLE test (value INTEGER)`);
		await db.run(sql`INSERT INTO test (value) VALUES (0)`);

		const gate = asyncGate();

		let t2Error: Error | null = null;

		// Transaction 1: write and hold lock
		const p1 = db.transaction(async () => {
			await db.run(sql`UPDATE test SET value = 1`);
			await gate.block();
		});

		await gate.hasBlocked();

		// Transaction 2: try to write while t1 holds lock
		const p2 = db.transaction(async () => {
			try {
				await db.run(sql`UPDATE test SET value = 2`);
			} catch (e) {
				t2Error = e as Error;
			}
		});

		await p2;
		gate.release();
		await p1;

		// Verify SQLITE_BUSY was thrown and is detectable via code and errorNumber
		expect(t2Error).toBeInstanceOf(QueryError);
		expect(t2Error).not.toBeNull();
		expect((t2Error as unknown as QueryError).code).toBe("SQLITE_BUSY");
		expect((t2Error as unknown as QueryError).errorNumber).toBe(5);

		db.close();
	});
});
