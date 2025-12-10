import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AbortException } from "../http/abort.ts";
import {
	createTestApplication,
	mockIntegrationContext,
} from "../test-utils/http-test-utils.bun.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
import { sqliteDatabase } from "./adapters/sqlite/sqliteDatabase.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import { DatabaseClientImpl } from "./DatabaseClientImpl.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";
import { ClientNotFoundError, QueryError } from "./database-errors.ts";
import { sql } from "./sql.ts";

describe("DatabaseImpl", () => {
	describe("supportsTransactions", () => {
		test("reflects adapter capability", async () => {
			const adapter = sqliteDatabase({ path: ":memory:" });
			const db = new DatabaseImpl(adapter, mockDispatcher());

			expect(db.supportsTransactions).toBe(true);

			adapter.dispose();
		});
	});

	describe("convenience methods", () => {
		let adapter: DatabaseAdapter;
		let db: DatabaseImpl;

		beforeEach(async () => {
			adapter = sqliteDatabase({ path: ":memory:" });
			db = new DatabaseImpl(adapter, mockDispatcher());
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

			const row = await app.withIntegration(mockIntegrationContext(), () =>
				db.firstOrNotFound(sql`SELECT * FROM test`),
			);

			expect(row.name).toBe("Alice");
		});

		test("firstOrNotFound() throws AbortException when no rows", async () => {
			const { app } = createTestApplication({ database: adapter });

			expect(
				app.withIntegration(mockIntegrationContext(), () =>
					db.firstOrNotFound(sql`SELECT * FROM test WHERE 0`),
				),
			).rejects.toBeInstanceOf(AbortException);
		});
	});

	describe("multiple clients", () => {
		let defaultAdapter: DatabaseAdapter;
		let additionalAdapter: DatabaseAdapter;

		beforeEach(async () => {
			defaultAdapter = sqliteDatabase({ path: ":memory:" });
			additionalAdapter = sqliteDatabase({ path: ":memory:" });

			await new DatabaseClientImpl(defaultAdapter, mockDispatcher()).batch([
				sql`CREATE TABLE info (db_name TEXT)`,
				sql`INSERT INTO info (db_name) VALUES ('default')`,
			]);
			await new DatabaseClientImpl(additionalAdapter, mockDispatcher()).batch([
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

		test("client() queries default database", async () => {
			const db = new DatabaseImpl(
				{ default: defaultAdapter, additional: { additional: additionalAdapter } },
				mockDispatcher(),
			);

			const dbName = await db.client().scalar(sql`SELECT db_name FROM info`);
			expect(dbName).toBe("default");
		});

		test("await sql`...` selects from default client", async () => {
			const result = await sql`SELECT db_name FROM info`;
			expect(result[0].db_name).toBe("default");
		});

		test("await sql`...`.on() selects default client", async () => {
			const result = await sql`SELECT db_name FROM info`.on("default");
			expect(result[0].db_name).toBe("default");
		});

		test("await sql`...`.on('name') selects named client", async () => {
			const result = await sql`SELECT db_name FROM info`.on("additional");
			expect(result[0].db_name).toBe("additional");
		});

		test("client() queries named database", async () => {
			const db = new DatabaseImpl(
				{ default: defaultAdapter, additional: { additional: additionalAdapter } },
				mockDispatcher(),
			);

			const dbName = await db.client("additional").scalar(sql`SELECT db_name FROM info`);
			expect(dbName).toBe("additional");
		});

		test("client() throws ClientNotFoundError for unknown name", () => {
			const db = new DatabaseImpl(defaultAdapter, mockDispatcher());

			expect(() => db.client("nonexistent")).toThrow(ClientNotFoundError);
		});
	});
});
