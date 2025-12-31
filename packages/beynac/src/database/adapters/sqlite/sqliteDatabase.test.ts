import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { asyncGate } from "../../../test-utils/async-gate.bun.ts";
import { type MockDispatcher, mockDispatcher } from "../../../test-utils/internal-mocks.bun.ts";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import type { DatabaseClient } from "../../DatabaseClient.ts";
import { DatabaseClientImpl } from "../../DatabaseClientImpl.ts";
import { TransactionRetryingEvent } from "../../database-events.ts";
import { sql } from "../../sql.ts";
import { SqliteDatabaseAdapter } from "./SqliteDatabaseAdapter.ts";

describe("SqliteDatabase", () => {
	let testDir: string;
	let dbPath: string;
	let adapter: SqliteDatabaseAdapter;
	let dispatcher: MockDispatcher;
	let db: DatabaseClient;

	beforeEach(() => {
		testDir = createTestDirectory();
		dbPath = join(testDir, "test.db");
		adapter = new SqliteDatabaseAdapter({ path: dbPath, transactionRetry: false });
		dispatcher = mockDispatcher();
		db = new DatabaseClientImpl(adapter, dispatcher);
		dispatcher.clear();
	});

	afterEach(() => {
		db.dispose();
	});

	test("readOnly prevents writes", async () => {
		const conn1 = await adapter.acquireConnection();
		await adapter.run({
			sql: "CREATE TABLE test (id INTEGER)",
			params: [],
			connection: conn1,
			prepare: undefined,
		});
		adapter.releaseConnection(conn1);
		adapter.dispose();

		const readOnlyAdapter = new SqliteDatabaseAdapter({
			path: dbPath,
			readOnly: true,
			transactionRetry: false,
		});
		const conn2 = await readOnlyAdapter.acquireConnection();
		expect(
			readOnlyAdapter.run({
				sql: "INSERT INTO test (id) VALUES (1)",
				params: [],
				connection: conn2,
				prepare: undefined,
			}),
		).rejects.toThrow();
		readOnlyAdapter.releaseConnection(conn2);
		readOnlyAdapter.dispose();
	});

	test("create option creates parent directories by default", async () => {
		const nestedPath = join(testDir, "subdir", "nested", "test.db");
		const nestedAdapter = new SqliteDatabaseAdapter({ path: nestedPath, transactionRetry: false });
		const conn = await nestedAdapter.acquireConnection();
		await nestedAdapter.run({
			sql: "CREATE TABLE test (id INTEGER)",
			params: [],
			connection: conn,
			prepare: undefined,
		});
		nestedAdapter.releaseConnection(conn);
		nestedAdapter.dispose();

		expect(existsSync(nestedPath)).toBe(true);
	});

	test("create=false throws if file does not exist", () => {
		const nonexistentPath = join(testDir, "nonexistent.db");
		expect(() => {
			new SqliteDatabaseAdapter({ path: nonexistentPath, create: false, transactionRetry: false });
		}).toThrow("Database file does not exist");
	});

	test("enables WAL by default", async () => {
		const conn = await adapter.acquireConnection();
		const result = await adapter.run({
			sql: "PRAGMA journal_mode",
			params: [],
			connection: conn,
			prepare: undefined,
		});
		expect(result.rows[0].journal_mode).toBe("wal");
		adapter.releaseConnection(conn);
	});

	test("useWalMode=true enables WAL", async () => {
		const noWalAdapter = new SqliteDatabaseAdapter({
			path: dbPath,
			useWalMode: true,
			transactionRetry: false,
		});
		const conn = await noWalAdapter.acquireConnection();
		const result = await noWalAdapter.run({
			sql: "PRAGMA journal_mode",
			params: [],
			connection: conn,
			prepare: undefined,
		});
		expect(result.rows[0].journal_mode).toBe("wal");
		noWalAdapter.releaseConnection(conn);
		noWalAdapter.dispose();
	});

	test("useWalMode=false disables WAL", async () => {
		const noWalAdapter = new SqliteDatabaseAdapter({
			path: dbPath,
			useWalMode: false,
			transactionRetry: false,
		});
		const conn = await noWalAdapter.acquireConnection();
		const result = await noWalAdapter.run({
			sql: "PRAGMA journal_mode",
			params: [],
			connection: conn,
			prepare: undefined,
		});
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

	test("transaction retries on write lock contention with IMMEDIATE mode", async () => {
		await db.run(sql`CREATE TABLE test (value TEXT)`);
		await db.run(sql`INSERT INTO test (value) VALUES ('0')`);

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
		const tx2Promise = db.transaction(
			async () => {
				await db.run(sql`UPDATE test SET value = value || '+tx2'`);
			},
			{
				sqliteMode: "immediate",
				retry: { maxAttempts: 3, startingDelay: 0 },
			},
		);

		// Release TX1 immediately - TX2's first attempt has already failed synchronously
		tx1Gate.release();

		await Promise.all([tx1Promise, tx2Promise]);

		const retryEvents = dispatcher.getEvents(TransactionRetryingEvent);
		expect(retryEvents).toHaveLength(1);
		expect(retryEvents[0].error?.toString()).toInclude("SQLITE_BUSY: The database file is locked");

		const result = await db.scalar<string>(sql`SELECT value FROM test`);
		expect(result).toBe("tx1+tx2");
	});

	test("transaction retries on COMMIT blocked by SHARED lock", async () => {
		// Disable WAL mode - in WAL mode readers don't block writers
		adapter = new SqliteDatabaseAdapter({
			path: dbPath,
			useWalMode: false,
			transactionRetry: false,
		});
		dispatcher = mockDispatcher();
		db = new DatabaseClientImpl(adapter, dispatcher);
		await db.run(sql`CREATE TABLE test (value TEXT)`);
		await db.run(sql`INSERT INTO test (value) VALUES ('0')`);
		dispatcher.clear();

		const tx1Gate = asyncGate();
		let tx1Done: () => void;
		const tx1DonePromise = new Promise<void>((r) => (tx1Done = r));
		let shouldWaitForTx1 = false;

		// TX1: Acquires SHARED lock via SELECT, blocks, then upgrades to RESERVED via UPDATE
		const tx1Promise = db
			.transaction(async () => {
				await db.run(sql`SELECT * FROM test`); // SHARED lock
				await tx1Gate.block();
				await db.run(sql`UPDATE test SET value = 'tx1'`); // RESERVED lock, then EXCLUSIVE on commit
			})
			.then(() => tx1Done());

		await tx1Gate.hasBlocked();

		// When TX2's COMMIT fails and retry is triggered, release TX1 and signal TX2 to wait
		dispatcher.addListener(TransactionRetryingEvent, () => {
			tx1Gate.release();
			shouldWaitForTx1 = true;
		});

		// TX2: Acquires SHARED (SELECT), then RESERVED (UPDATE), then fails at COMMIT
		// because it needs EXCLUSIVE but TX1 still holds SHARED.
		const tx2Promise = db.transaction(
			async () => {
				// On retry, wait for TX1 to complete before acquiring SHARED
				if (shouldWaitForTx1) {
					await tx1DonePromise;
				}
				await db.run(sql`SELECT * FROM test`); // SHARED lock
				await db.run(sql`UPDATE test SET value = value || '+tx2'`); // RESERVED lock
				// COMMIT will need EXCLUSIVE - fails on first attempt because TX1 has SHARED
			},
			{ retry: { maxAttempts: 3, startingDelay: 0 } },
		);

		await Promise.all([tx1Promise, tx2Promise]);

		const retryEvents = dispatcher.getEvents(TransactionRetryingEvent);
		expect(retryEvents).toHaveLength(1);
		expect(retryEvents[0].error?.toString()).toInclude("SQLITE_BUSY: The database file is locked");

		// TX1 committed first (set value to 'tx1'), then TX2 retry appended '+tx2'
		const result = await db.scalar<string>(sql`SELECT value FROM test`);
		expect(result).toBe("tx1+tx2");
	});

	test("transaction retries on read blocked by EXCLUSIVE lock", async () => {
		await db.run(sql`CREATE TABLE test (value TEXT)`);
		await db.run(sql`INSERT INTO test (value) VALUES ('0')`);

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

		// TX2: BEGIN EXCLUSIVE fails with SQLITE_BUSY because TX1 holds exclusive lock
		const tx2Promise = db.transaction(
			async () => {
				await db.run(sql`SELECT * FROM test`);
			},
			{
				sqliteMode: "exclusive",
				retry: { maxAttempts: 3, startingDelay: 0 },
			},
		);

		// Release TX1 immediately - TX2's first attempt has already failed synchronously
		tx1Gate.release();

		await Promise.all([tx1Promise, tx2Promise]);

		const retryEvents = dispatcher.getEvents(TransactionRetryingEvent);
		expect(retryEvents).toHaveLength(1);
		expect(retryEvents[0].error?.toString()).toInclude("SQLITE_BUSY: The database file is locked");
	});
});
