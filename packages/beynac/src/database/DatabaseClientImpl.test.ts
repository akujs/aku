import { afterEach, beforeAll, beforeEach, describe, expect, mock as mockFn, test } from "bun:test";
import { join } from "node:path";
import { sleep } from "../helpers/async/sleep.ts";
import { asyncGate } from "../test-utils/async-gate.bun.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
import { mock } from "../testing/mocks.ts";
import { createTestDirectory } from "../testing/test-directories.ts";
import { createPostgresAdapter, resetSchema } from "./adapters/postgres/postgres-test-utils.ts";
import { sqliteDatabase } from "./adapters/sqlite/sqliteDatabase.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import { DatabaseClientImpl } from "./DatabaseClientImpl.ts";
import { DatabaseError, QueryError } from "./database-errors.ts";
import { sql } from "./sql.ts";

describe(DatabaseClientImpl, () => {
	let adapter: DatabaseAdapter;
	let db: DatabaseClientImpl;

	beforeEach(async () => {
		const testDir = createTestDirectory();
		adapter = sqliteDatabase({ path: join(testDir, "test.db") });
		db = new DatabaseClientImpl(adapter, mockDispatcher());
		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)`);
	});

	afterEach(() => {
		adapter?.dispose();
	});

	describe("transaction retry", () => {
		test("retry: false doesn't retry on concurrency error", async () => {
			const callback = mockFn(async () => {
				throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
			});

			expect(db.transaction(callback, { retry: false })).rejects.toThrow(QueryError);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test("retry: true retries on concurrency error", async () => {
			mock(sleep, async () => {});

			const callback = mockFn(async () => {
				if (callback.mock.calls.length < 3) {
					throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
				}
				await db.run(sql`INSERT INTO test (value) VALUES ('success')`);
			});

			await db.transaction(callback, { retry: true });

			expect(callback).toHaveBeenCalledTimes(3);
			const result = await db.scalar(sql`SELECT value FROM test`);
			expect(result).toBe("success");
		});

		test("retry: number limits retry attempts", async () => {
			mock(sleep, async () => {});

			const callback = mockFn(async () => {
				throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
			});

			expect(db.transaction(callback, { retry: 3 })).rejects.toBeInstanceOf(QueryError);

			expect(callback).toHaveBeenCalledTimes(3);
		});

		test("retry doesn't retry on non-concurrency errors", async () => {
			mock(sleep, async () => {});

			const callback = mockFn(async () => {
				throw new Error("Some other error");
			});

			expect(db.transaction(callback, { retry: true })).rejects.toThrow("Some other error");

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test("retry: {shouldRetry} Can be used to enable retries on other errors", async () => {
			mock(sleep, async () => {});

			const callback = mockFn(async () => {
				if (callback.mock.calls.length < 3) {
					throw new QueryError("SELECT 1", "wotcha", null);
				}
				await db.run(sql`INSERT INTO test (value) VALUES ('success')`);
			});

			await db.transaction(callback, { retry: { shouldRetry: () => true } });

			expect(callback).toHaveBeenCalledTimes(3);
			const result = await db.scalar(sql`SELECT value FROM test`);
			expect(result).toBe("success");
		});

		test("retry with custom RetryOptions", async () => {
			const delays: number[] = [];
			mock(sleep, async (ms: number) => {
				delays.push(ms);
			});

			const callback = mockFn(async () => {
				if (callback.mock.calls.length < 3) {
					throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
				}
			});

			await db.transaction(callback, {
				retry: { maxAttempts: 5, startingDelay: 50, jitterFactor: 0 },
			});

			expect(callback).toHaveBeenCalledTimes(3);
			expect(delays).toEqual([50, 100]);
		});

		test("retry rolls back transaction before retrying", async () => {
			mock(sleep, async () => {});

			const callback = mockFn(async () => {
				const attempt = callback.mock.calls.length;
				await db.run(sql`INSERT INTO test (value) VALUES (${`attempt-${attempt}`})`);
				if (attempt < 2) {
					throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
				}
			});

			await db.transaction(callback, { retry: true });

			// Only the final successful attempt should be committed
			expect(callback).toHaveBeenCalledTimes(2);
			const rows = await db.all(sql`SELECT value FROM test ORDER BY id`);
			expect(rows).toEqual([{ value: "attempt-2" }]);
		});
	});

	test("query that executes after its transaction commits throws an error", async () => {
		const gate = asyncGate();
		let delayedQueryError: Error | undefined;
		let delayedQueryPromise: Promise<void> | undefined;

		await db.transaction(async () => {
			await db.run(sql`INSERT INTO test (value) VALUES ('before')`);

			setTimeout(async () => {
				await gate.block();
				try {
					await db.run(sql`INSERT INTO test (value) VALUES ('delayed')`);
				} catch (e) {
					delayedQueryError = e as Error;
				}
			}, 0);

			delayedQueryPromise = gate.hasBlocked();
		});

		// Transaction has committed - wait for setTimeout to reach the gate, then release
		await delayedQueryPromise;
		await gate.releaseAndWaitTick();

		expect(delayedQueryError).toBeInstanceOf(DatabaseError);
		expect(delayedQueryError?.message).toInclude("the transaction has already been committed");

		// Only the first insert should be present
		const rows = await db.all(sql`SELECT value FROM test`);
		expect(rows).toEqual([{ value: "before" }]);
	});

	test("query from outer transaction that executes during inner transaction throws an error", async () => {
		const outerGate = asyncGate();
		// const innerGate = asyncGate();
		let delayedQueryError: Error | undefined;

		await db.transaction(async () => {
			setTimeout(async () => {
				await outerGate.block();
				try {
					await db.run(sql`INSERT INTO test (value) VALUES ('from-outer')`);
				} catch (e) {
					delayedQueryError = e as Error;
				}
				// innerGate.release();
			}, 0);

			await db.transaction(async () => {
				await outerGate.hasBlocked();
				await outerGate.releaseAndWaitTick();
				// await innerGate.block();
				await db.run(sql`INSERT INTO test (value) VALUES ('from-inner')`);
			});
		});

		expect(delayedQueryError).toBeInstanceOf(DatabaseError);
		expect(delayedQueryError?.message).toInclude("a nested transaction is active");
	});

	test("escapeTransaction runs outside transaction context", async () => {
		await db.transaction(async () => {
			expect(db.transactionId).not.toBeNull();
			expect(db.transactionDepth).toBe(1);
			const outerTxId = db.transactionId;

			await db.escapeTransaction(async () => {
				expect(db.transactionId).toBeNull();
				expect(db.transactionDepth).toBe(0);
			});

			// Context is restored after escapeTransaction
			expect(db.transactionId).toBe(outerTxId);
			expect(db.transactionDepth).toBe(1);
		});
	});

	test("escapeTransaction called outside transaction still works", async () => {
		// escapeTransaction should be safe to call even when not in a transaction
		expect(db.transactionDepth).toBe(0);

		await db.escapeTransaction(async () => {
			expect(db.transactionDepth).toBe(0);

			// Can start a normal transaction
			await db.transaction(async () => {
				expect(db.transactionDepth).toBe(1);
				await db.run(sql`INSERT INTO test (value) VALUES ('escaped')`);
			});
		});

		const rows = await db.all(sql`SELECT value FROM test`);
		expect(rows).toEqual([{ value: "escaped" }]);
	});
});

// These tests use Postgres because it supports concurrent connections to the same database,
// unlike SQLite which has single-writer limitations
describe("escapeTransaction with Postgres", () => {
	let adapter: DatabaseAdapter;
	let db: DatabaseClientImpl;

	beforeAll(async () => {
		adapter = createPostgresAdapter();
		db = new DatabaseClientImpl(adapter, mockDispatcher());
		await db.run(resetSchema);
		await db.run(sql`CREATE TABLE test (id SERIAL PRIMARY KEY, value TEXT)`);
	});

	beforeEach(async () => {
		await db.run(sql`DELETE FROM test`);
	});

	test("escapeTransaction commits independently within rolled back outer transaction", async () => {
		const testError = new Error("intentional rollback");
		let escapedPromise: Promise<void> | undefined;
		const gate = asyncGate();

		try {
			await db.transaction(async () => {
				await db.run(sql`INSERT INTO test (value) VALUES ('outer')`);

				// Start an independent transaction that will complete after we throw
				escapedPromise = db.escapeTransaction(async () => {
					await gate.block();
					await db.run(sql`INSERT INTO test (value) VALUES ('escaped')`);
				});

				// ensure independent transaction has started
				await gate.hasBlocked();

				// Wait for escaped transaction to complete
				await gate.releaseAndWaitTick();
				await escapedPromise;

				throw testError;
			});
		} catch (e) {
			expect(e).toBe(testError);
		}

		// Outer transaction rolled back, escaped transaction committed
		const rows = await db.all(sql`SELECT value FROM test ORDER BY id`);
		expect(rows).toEqual([{ value: "escaped" }]);
	});

	test("escapeTransaction commits independently after rolled back outer transaction", async () => {
		const testError = new Error("intentional rollback");
		let escapedPromise: Promise<void> | undefined;
		const gate = asyncGate();

		try {
			await db.transaction(async () => {
				await db.run(sql`INSERT INTO test (value) VALUES ('outer')`);

				// Start an independent transaction that will complete after we throw
				escapedPromise = db.escapeTransaction(async () => {
					await gate.block();
					await db.run(sql`INSERT INTO test (value) VALUES ('escaped')`);
				});

				// ensure independent transaction has started
				await gate.hasBlocked();

				throw testError;
			});
		} catch (e) {
			expect(e).toBe(testError);
		}

		// Wait for escaped transaction to complete
		await gate.releaseAndWaitTick();
		await escapedPromise;

		// Outer transaction rolled back, escaped transaction committed
		const rows = await db.all(sql`SELECT value FROM test ORDER BY id`);
		expect(rows).toEqual([{ value: "escaped" }]);
	});
});
