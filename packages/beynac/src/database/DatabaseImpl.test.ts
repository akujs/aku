import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { sleep } from "../helpers/async/sleep.ts";
import { AbortException } from "../http/abort.ts";
import { createTestApplication, integrationContext } from "../test-utils/http-test-utils.bun.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
import { mock, resetAllMocks } from "../testing/mocks.ts";
import { sqliteDatabase } from "./adapters/sqlite/sqliteDatabase.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import { DatabaseConnectionImpl } from "./DatabaseConnectionImpl.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";
import { ConnectionNotFoundError, QueryError } from "./database-errors.ts";
import { sql } from "./sql.ts";

describe("DatabaseImpl", () => {
	describe("supportsTransactions", () => {
		test("reflects adapter capability", async () => {
			const adapter = sqliteDatabase({ path: ":memory:" });
			const db = new DatabaseImpl(adapter, {}, mockDispatcher());

			expect(db.supportsTransactions).toBe(true);

			adapter.dispose();
		});
	});

	describe("convenience methods", () => {
		let adapter: DatabaseAdapter;
		let db: DatabaseImpl;

		beforeEach(async () => {
			adapter = sqliteDatabase({ path: ":memory:" });
			db = new DatabaseImpl(adapter, {}, mockDispatcher());
			await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
			await db.run(sql`INSERT INTO test (name) VALUES ('Alice'), ('Bob')`);
		});

		afterEach(() => {
			adapter.dispose();
		});

		test("all() returns rows", async () => {
			const rows = await db.all(sql`SELECT name FROM test ORDER BY id`);
			expect(rows).toEqual([{ name: "Alice" }, { name: "Bob" }]);
		});

		test("all() returns empty array when no rows", async () => {
			const rows = await db.all(sql`SELECT name FROM test WHERE 0`);
			expect(rows).toEqual([]);
		});

		test("first() returns first row", async () => {
			const row = await db.first(sql`SELECT * FROM test ORDER BY name`);
			expect(row.name).toBe("Alice");
		});

		test("first() throws when no rows", async () => {
			expect(db.first(sql`SELECT * FROM test WHERE 0`)).rejects.toThrow("Query returned no rows");
		});

		test("firstOrNull() returns first row when exists", async () => {
			const row = await db.firstOrNull(sql`SELECT * FROM test`);
			expect(row?.name).toBe("Alice");
		});

		test("firstOrNull() returns null when no rows", async () => {
			const row = await db.firstOrNull(sql`SELECT * FROM test WHERE 0`);
			expect(row).toBeNull();
		});

		test("firstOrFail() returns first row when exists", async () => {
			const row = await db.firstOrFail(sql`SELECT * FROM test`);
			expect(row.name).toBe("Alice");
		});

		test("firstOrFail() throws QueryError when no rows", async () => {
			expect(db.firstOrFail(sql`SELECT * FROM test WHERE 0`)).rejects.toBeInstanceOf(QueryError);
		});

		test("scalar() returns first column of first row", async () => {
			const name = await db.scalar(sql`SELECT name FROM test`);
			expect(name).toBe("Alice");
		});

		test("scalar() throws QueryError when no rows", async () => {
			expect(db.scalar(sql`SELECT name FROM test WHERE 0`)).rejects.toBeInstanceOf(QueryError);
		});

		test("column() returns first column of each row", async () => {
			const names = await db.column(sql`SELECT name FROM test ORDER BY id`);
			expect(names).toEqual(["Alice", "Bob"]);
		});

		test("column() returns empty array when no rows", async () => {
			const names = await db.column(sql`SELECT name FROM test WHERE 0`);
			expect(names).toEqual([]);
		});

		test("firstOrNotFound() returns first row when exists", async () => {
			const { app } = createTestApplication({ database: adapter });

			const row = await app.withIntegration(integrationContext(), () =>
				db.firstOrNotFound(sql`SELECT * FROM test`),
			);

			expect(row.name).toBe("Alice");
		});

		test("firstOrNotFound() throws AbortException when no rows", async () => {
			const { app } = createTestApplication({ database: adapter });

			expect(
				app.withIntegration(integrationContext(), () =>
					db.firstOrNotFound(sql`SELECT * FROM test WHERE 0`),
				),
			).rejects.toBeInstanceOf(AbortException);
		});
	});

	describe("multiple connections", () => {
		let defaultAdapter: DatabaseAdapter;
		let additionalAdapter: DatabaseAdapter;

		beforeEach(async () => {
			defaultAdapter = sqliteDatabase({ path: ":memory:" });
			additionalAdapter = sqliteDatabase({ path: ":memory:" });

			await new DatabaseConnectionImpl(defaultAdapter, mockDispatcher()).batch([
				sql`CREATE TABLE info (db_name TEXT)`,
				sql`INSERT INTO info (db_name) VALUES ('default')`,
			]);
			await new DatabaseConnectionImpl(additionalAdapter, mockDispatcher()).batch([
				sql`CREATE TABLE info (db_name TEXT)`,
				sql`INSERT INTO info (db_name) VALUES ('additional')`,
			]);
			void createTestApplication({
				database: { default: defaultAdapter, additional: { additional: additionalAdapter } },
			}).app;
		});

		afterEach(() => {
			defaultAdapter.dispose();
			additionalAdapter.dispose();
		});

		test("connection() queries default database", async () => {
			const db = new DatabaseImpl(
				defaultAdapter,
				{ additional: additionalAdapter },
				mockDispatcher(),
			);

			const dbName = await db.connection().scalar(sql`SELECT db_name FROM info`);
			expect(dbName).toBe("default");
		});

		test("await sql`...` selects from default connection", async () => {
			const result = await sql`SELECT db_name FROM info`;
			expect(result[0].db_name).toBe("default");
		});

		test("await sql`...`.on() selects can select default connection", async () => {
			const result = await sql`SELECT db_name FROM info`.on("default");
			expect(result[0].db_name).toBe("default");
		});

		test("await sql`...`.on() selects connection", async () => {
			const result = await sql`SELECT db_name FROM info`.on("additional");
			expect(result[0].db_name).toBe("additional");
		});

		test("connection() queries named database", async () => {
			const db = new DatabaseImpl(
				defaultAdapter,
				{ additional: additionalAdapter },
				mockDispatcher(),
			);

			const dbName = await db.connection("additional").scalar(sql`SELECT db_name FROM info`);
			expect(dbName).toBe("additional");
		});

		test("connection() throws ConnectionNotFoundError for unknown name", () => {
			const db = new DatabaseImpl(defaultAdapter, {}, mockDispatcher());

			expect(() => db.connection("nonexistent")).toThrow(ConnectionNotFoundError);
		});
	});
});

describe(DatabaseConnectionImpl, () => {
	describe("transaction retry", () => {
		let adapter: DatabaseAdapter;
		let db: DatabaseConnectionImpl;

		afterEach(() => {
			resetAllMocks();
			adapter?.dispose();
		});

		async function createDb(): Promise<void> {
			adapter = sqliteDatabase({ path: ":memory:" });
			db = new DatabaseConnectionImpl(adapter, mockDispatcher());
			await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)`);
		}

		test("retry: false doesn't retry on concurrency error", async () => {
			await createDb();
			let attempts = 0;

			try {
				await db.transaction(
					async () => {
						attempts++;
						throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
					},
					{ retry: false },
				);
				expect.unreachable("should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(QueryError);
			}

			expect(attempts).toBe(1);
		});

		test("retry: true retries on concurrency error", async () => {
			await createDb();
			mock(sleep, async () => {});

			let attempts = 0;

			await db.transaction(
				async () => {
					attempts++;
					if (attempts < 3) {
						throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
					}
					await db.run(sql`INSERT INTO test (value) VALUES ('success')`);
				},
				{ retry: true },
			);

			expect(attempts).toBe(3);
			const result = await db.scalar(sql`SELECT value FROM test`);
			expect(result).toBe("success");
		});

		test("retry: number limits retry attempts", async () => {
			await createDb();
			mock(sleep, async () => {});

			let attempts = 0;

			try {
				await db.transaction(
					async () => {
						attempts++;
						throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
					},
					{ retry: 3 },
				);
				expect.unreachable("should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(QueryError);
			}

			expect(attempts).toBe(3);
		});

		test("retry doesn't retry on non-concurrency errors", async () => {
			await createDb();
			mock(sleep, async () => {});

			let attempts = 0;

			try {
				await db.transaction(
					async () => {
						attempts++;
						throw new Error("Some other error");
					},
					{ retry: true },
				);
				expect.unreachable("should have thrown");
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).message).toBe("Some other error");
			}

			expect(attempts).toBe(1);
		});

		test("retry with custom RetryOptions", async () => {
			await createDb();
			const delays: number[] = [];
			mock(sleep, async (ms: number) => {
				delays.push(ms);
			});

			let attempts = 0;

			await db.transaction(
				async () => {
					attempts++;
					if (attempts < 3) {
						throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
					}
				},
				{ retry: { maxAttempts: 5, startingDelay: 50, jitterFactor: 0 } },
			);

			expect(attempts).toBe(3);
			expect(delays).toEqual([50, 100]);
		});

		test("retry rolls back transaction before retrying", async () => {
			await createDb();
			mock(sleep, async () => {});

			let attempts = 0;

			await db.transaction(
				async () => {
					attempts++;
					await db.run(sql`INSERT INTO test (value) VALUES (${`attempt-${attempts}`})`);
					if (attempts < 2) {
						throw new QueryError("SELECT 1", "database is locked", null, "SQLITE_BUSY", 5);
					}
				},
				{ retry: true },
			);

			// Only the final successful attempt should be committed
			const rows = await db.all(sql`SELECT value FROM test ORDER BY id`);
			expect(rows).toEqual([{ value: "attempt-2" }]);
		});
	});
});
