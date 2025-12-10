import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { asyncGate } from "../../../test-utils/async-gate.bun.ts";
import { mockDispatcher } from "../../../test-utils/internal-mocks.bun.ts";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { DatabaseConnectionImpl } from "../../DatabaseConnectionImpl.ts";
import { QueryError } from "../../database-errors.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { sql } from "../../sql.ts";
import { sqliteDatabase } from "./_SqliteDatabase.ts";
import { SqliteDatabaseAdapter } from "./SqliteDatabaseAdapter.ts";

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

describe("SqliteDatabase", () => {
	test("readOnly prevents writes", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "test.db");

		const adapter1 = new SqliteDatabaseAdapter({ path: dbPath });
		const conn1 = await adapter1.acquireConnection();
		await adapter1.run(sql`CREATE TABLE test (id INTEGER)`, conn1);
		adapter1.releaseConnection(conn1);
		adapter1.dispose();

		const adapter2 = new SqliteDatabaseAdapter({ path: dbPath, readOnly: true });
		const conn2 = await adapter2.acquireConnection();
		expect(adapter2.run(sql`INSERT INTO test (id) VALUES (1)`, conn2)).rejects.toThrow();
		adapter2.releaseConnection(conn2);
		adapter2.dispose();
	});

	test("create option creates parent directories by default", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "subdir", "nested", "test.db");

		const adapter = new SqliteDatabaseAdapter({ path: dbPath });
		const conn = await adapter.acquireConnection();
		await adapter.run(sql`CREATE TABLE test (id INTEGER)`, conn);
		adapter.releaseConnection(conn);
		adapter.dispose();

		expect(existsSync(dbPath)).toBe(true);
	});

	test("create=false throws if file does not exist", () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "nonexistent.db");

		expect(() => {
			new SqliteDatabaseAdapter({ path: dbPath, create: false });
		}).toThrow("Database file does not exist");
	});

	test("useWalMode enables WAL by default", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "test.db");

		const adapter = new SqliteDatabaseAdapter({ path: dbPath });
		const conn = await adapter.acquireConnection();
		const result = await adapter.run(sql`PRAGMA journal_mode`, conn);
		expect(result.rows[0].journal_mode).toBe("wal");
		adapter.releaseConnection(conn);
		adapter.dispose();
	});

	test("useWalMode=false disables WAL", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "test.db");

		const adapter = new SqliteDatabaseAdapter({ path: dbPath, useWalMode: false });
		const conn = await adapter.acquireConnection();
		const result = await adapter.run(sql`PRAGMA journal_mode`, conn);
		expect(result.rows[0].journal_mode).toBe("delete");
		adapter.releaseConnection(conn);
		adapter.dispose();
	});

	test("uncommitted transaction writes are not visible outside transaction", async () => {
		const testDir = createTestDirectory();
		const dbPath = join(testDir, "test.db");

		const adapter = new SqliteDatabaseAdapter({ path: dbPath });
		const db = new DatabaseConnectionImpl(adapter, mockDispatcher());
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

		db.dispose();
	});

	test("concurrent transaction uses different connection", async () => {
		const testDir = createTestDirectory({ prefix: "sqlite-conn-" });
		const dbPath = join(testDir, "test.db");

		const adapter = new SqliteDatabaseAdapter({ path: dbPath });
		const db = new DatabaseConnectionImpl(adapter, mockDispatcher());
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

		db.dispose();
	});

	test("concurrent write transactions can throw SQLITE_BUSY", async () => {
		const testDir = createTestDirectory({ prefix: "sqlite-busy-" });
		const dbPath = join(testDir, "test.db");

		const adapter = new SqliteDatabaseAdapter({ path: dbPath });
		const db = new DatabaseConnectionImpl(adapter, mockDispatcher());
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

		db.dispose();
	});
});
