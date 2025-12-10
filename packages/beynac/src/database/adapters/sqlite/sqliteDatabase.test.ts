import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { asyncGate } from "../../../test-utils/async-gate.bun.ts";
import { type MockDispatcher, mockDispatcher } from "../../../test-utils/internal-mocks.bun.ts";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import type { DatabaseClient } from "../../contracts/Database.ts";
import { DatabaseClientImpl } from "../../DatabaseClientImpl.ts";
import { QueryError } from "../../database-errors.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { sql } from "../../sql.ts";
import { SqliteDatabaseAdapter } from "./SqliteDatabaseAdapter.ts";
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

describe("SqliteDatabase", () => {
	let testDir: string;
	let dbPath: string;
	let adapter: SqliteDatabaseAdapter;
	let dispatcher: MockDispatcher;
	let db: DatabaseClient;

	beforeEach(() => {
		testDir = createTestDirectory();
		dbPath = join(testDir, "test.db");
		adapter = new SqliteDatabaseAdapter({ path: dbPath });
		dispatcher = mockDispatcher();
		db = new DatabaseClientImpl(adapter, dispatcher);
	});

	afterEach(() => {
		db.dispose();
	});

	test("readOnly prevents writes", async () => {
		const conn1 = await adapter.acquireConnection();
		await adapter.run(sql`CREATE TABLE test (id INTEGER)`, conn1);
		adapter.releaseConnection(conn1);
		adapter.dispose();

		const readOnlyAdapter = new SqliteDatabaseAdapter({ path: dbPath, readOnly: true });
		const conn2 = await readOnlyAdapter.acquireConnection();
		expect(readOnlyAdapter.run(sql`INSERT INTO test (id) VALUES (1)`, conn2)).rejects.toThrow();
		readOnlyAdapter.releaseConnection(conn2);
		readOnlyAdapter.dispose();
	});

	test("create option creates parent directories by default", async () => {
		const nestedPath = join(testDir, "subdir", "nested", "test.db");
		const nestedAdapter = new SqliteDatabaseAdapter({ path: nestedPath });
		const conn = await nestedAdapter.acquireConnection();
		await nestedAdapter.run(sql`CREATE TABLE test (id INTEGER)`, conn);
		nestedAdapter.releaseConnection(conn);
		nestedAdapter.dispose();

		expect(existsSync(nestedPath)).toBe(true);
	});

	test("create=false throws if file does not exist", () => {
		const nonexistentPath = join(testDir, "nonexistent.db");
		expect(() => {
			new SqliteDatabaseAdapter({ path: nonexistentPath, create: false });
		}).toThrow("Database file does not exist");
	});

	test("enables WAL by default", async () => {
		const conn = await adapter.acquireConnection();
		const result = await adapter.run(sql`PRAGMA journal_mode`, conn);
		expect(result.rows[0].journal_mode).toBe("wal");
		adapter.releaseConnection(conn);
	});

	test("useWalMode=true enables WAL", async () => {
		const noWalAdapter = new SqliteDatabaseAdapter({ path: dbPath, useWalMode: true });
		const conn = await noWalAdapter.acquireConnection();
		const result = await noWalAdapter.run(sql`PRAGMA journal_mode`, conn);
		expect(result.rows[0].journal_mode).toBe("wal");
		noWalAdapter.releaseConnection(conn);
		noWalAdapter.dispose();
	});

	test("useWalMode=false disables WAL", async () => {
		const noWalAdapter = new SqliteDatabaseAdapter({ path: dbPath, useWalMode: false });
		const conn = await noWalAdapter.acquireConnection();
		const result = await noWalAdapter.run(sql`PRAGMA journal_mode`, conn);
		expect(result.rows[0].journal_mode).toBe("delete");
		noWalAdapter.releaseConnection(conn);
		noWalAdapter.dispose();
	});

	test("uncommitted transaction writes are not visible outside transaction", async () => {
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
	});

	test("concurrent transactions are permitted", async () => {
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
	});

	test("concurrent write transactions throws SQLITE_BUSY", async () => {
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
	});

	test("transaction retries on write lock contention with IMMEDIATE mode", async () => {
		await db.run(sql`CREATE TABLE test (value TEXT)`);
		await db.run(sql`INSERT INTO test (value) VALUES ('0')`);

		const originalRun = adapter.run.bind(adapter);
		const runSpy = spyOn(adapter, "run").mockImplementation(originalRun);

		const tx1Gate = asyncGate();

		// TX1: Acquires write lock immediately (at BEGIN IMMEDIATE), waits at gate
		const tx1Promise = db.transaction(
			async () => {
				await tx1Gate.block();
				await db.run(sql`UPDATE test SET value = 'tx1'`);
			},
			{ sqliteMode: "immediate" },
		);

		await tx1Gate.hasBlocked();

		// TX2: BEGIN IMMEDIATE fails with SQLITE_BUSY because TX1 holds the lock.
		// The retry happens at the transaction level (BEGIN fails, not the function).
		const tx2Fn = mock(async () => {
			await db.run(sql`UPDATE test SET value = value || '+tx2'`);
		});

		// Start TX2 - it will retry BEGIN IMMEDIATE until TX1 releases
		const tx2Promise = db.transaction(tx2Fn, {
			sqliteMode: "immediate",
			retry: { maxAttempts: 10, startingDelay: 5 },
		});

		// Give TX2 time to fail at least once before releasing TX1
		await new Promise((r) => setTimeout(r, 20));
		tx1Gate.release();

		await Promise.all([tx1Promise, tx2Promise]);

		// TX1 does one BEGIN IMMEDIATE, TX2 does at least 2 (first fails, retry succeeds)
		const beginImmediateAttempts = runSpy.mock.calls.filter(
			([stmt]) => stmt.renderForLogs() === "BEGIN IMMEDIATE",
		).length;
		expect(beginImmediateAttempts).toBeGreaterThan(2);
		// TX2's function body only runs once (after successful BEGIN)
		expect(tx2Fn.mock.calls.length).toBe(1);
		const result = await db.scalar<string>(sql`SELECT value FROM test`);
		expect(result).toBe("tx1+tx2");
	});

	test("transaction retries on write upgrade conflict", async () => {
		// Disable WAL mode - in WAL mode readers don't block writers
		adapter = new SqliteDatabaseAdapter({ path: dbPath, useWalMode: false });
		db = new DatabaseClientImpl(adapter, mockDispatcher());
		await db.run(sql`CREATE TABLE test (value TEXT)`);
		await db.run(sql`INSERT INTO test (value) VALUES ('0')`);

		const originalRun = adapter.run.bind(adapter);
		const runSpy = spyOn(adapter, "run").mockImplementation(originalRun);

		const tx1Gate = asyncGate();

		// TX1: Reads (SHARED lock), waits at gate, then writes
		const tx1Promise = db.transaction(async () => {
			await db.run(sql`SELECT * FROM test`);
			await tx1Gate.block();
			await db.run(sql`UPDATE test SET value = 'tx1'`);
		});

		await tx1Gate.hasBlocked();

		// TX2: Reads (SHARED lock), then tries to write and commit
		// In non-WAL mode, COMMIT fails with SQLITE_BUSY when another transaction
		// holds a RESERVED lock
		const tx2Fn = mock(async () => {
			await db.run(sql`SELECT * FROM test`);
			await db.run(sql`UPDATE test SET value = value || '+tx2'`);
		});

		// Start TX2 - it will complete its function but COMMIT will fail
		const tx2Promise = db.transaction(tx2Fn, { retry: { maxAttempts: 10, startingDelay: 5 } });

		// Give TX2 time to attempt and fail COMMIT before releasing TX1
		await new Promise((r) => setTimeout(r, 20));
		tx1Gate.release();

		await Promise.all([tx1Promise, tx2Promise]);

		// TX2 should have retried (BEGIN called multiple times)
		// We expect 3+: TX1's BEGIN, TX2's first BEGIN, TX2's retry BEGIN(s)
		const beginAttempts = runSpy.mock.calls.filter(
			([stmt]) => stmt.renderForLogs() === "BEGIN",
		).length;
		expect(beginAttempts).toBeGreaterThan(2);
		const result = await db.scalar<string>(sql`SELECT value FROM test`);
		expect(result).toBe("tx1+tx2");
	});

	test("transaction retries on read blocked by EXCLUSIVE lock", async () => {
		await db.run(sql`CREATE TABLE test (value TEXT)`);
		await db.run(sql`INSERT INTO test (value) VALUES ('0')`);

		const originalRun = adapter.run.bind(adapter);
		const runSpy = spyOn(adapter, "run").mockImplementation(originalRun);

		const tx1Gate = asyncGate();

		// TX1: Acquires exclusive lock (blocks all other access), waits at gate
		const tx1Promise = db.transaction(
			async () => {
				await tx1Gate.block();
				await db.run(sql`UPDATE test SET value = 'tx1'`);
			},
			{ sqliteMode: "exclusive" },
		);

		await tx1Gate.hasBlocked();

		// TX2: Even a read-only transaction fails with SQLITE_BUSY because TX1 holds exclusive lock
		const tx2Fn = mock(async () => {
			await db.run(sql`SELECT * FROM test`);
		});

		const tx2Promise = db.transaction(tx2Fn, {
			sqliteMode: "exclusive",
			retry: { maxAttempts: 10, startingDelay: 5 },
		});

		// Give TX2 time to fail at least once before releasing TX1
		await new Promise((r) => setTimeout(r, 20));
		tx1Gate.release();

		await Promise.all([tx1Promise, tx2Promise]);

		// TX1 does one BEGIN EXCLUSIVE, TX2 does at least 2 (first fails, retry succeeds)
		const beginExclusiveAttempts = runSpy.mock.calls.filter(
			([stmt]) => stmt.renderForLogs() === "BEGIN EXCLUSIVE",
		).length;
		expect(beginExclusiveAttempts).toBeGreaterThan(2);
		// TX2's function body only runs once (after successful BEGIN)
		expect(tx2Fn.mock.calls.length).toBe(1);
	});
});
