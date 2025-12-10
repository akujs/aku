import { afterEach, beforeEach, describe, expect, mock as mockFn, test } from "bun:test";
import { sleep } from "../helpers/async/sleep.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
import { mock } from "../testing/mocks.ts";
import { sqliteDatabase } from "./adapters/sqlite/sqliteDatabase.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import { DatabaseClientImpl } from "./DatabaseClientImpl.ts";
import { QueryError } from "./database-errors.ts";
import { sql } from "./sql.ts";

describe(DatabaseClientImpl, () => {
	describe("transaction retry", () => {
		let adapter: DatabaseAdapter;
		let db: DatabaseClientImpl;

		beforeEach(async () => {
			adapter = sqliteDatabase({ path: ":memory:" });
			db = new DatabaseClientImpl(adapter, mockDispatcher());
			await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)`);
		});

		afterEach(() => {
			adapter?.dispose();
		});

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
});
