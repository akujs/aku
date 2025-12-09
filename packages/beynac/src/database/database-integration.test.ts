import { describe, expect, test } from "bun:test";
import { AbortException } from "../http/abort.ts";
import { createTestApplication, integrationContext } from "../test-utils/http-test-utils.bun.ts";
import { SqliteDatabaseAdapter } from "./adapters/sqlite/SqliteDatabaseAdapter.ts";
import { Database } from "./contracts/Database.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";
import { QueryError } from "./database-errors.ts";
import { sql } from "./sql.ts";

describe("Database integration with Application", () => {
	test("database is accessible via container when configured", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });

		const db = container.get(Database);
		expect(db).toBeInstanceOf(DatabaseImpl);

		adapter.dispose();
	});

	test("supportsTransactions reflects adapter capability", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });

		const db = container.get(Database);
		expect(db.supportsTransactions).toBe(true);

		adapter.dispose();
	});
});

describe("Database convenience methods", () => {
	async function createDb() {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const db = new DatabaseImpl(adapter);
		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
		return { db, adapter };
	}

	test("all() returns rows", async () => {
		const { db, adapter } = await createDb();
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice'), ('Bob')`);

		const rows = await db.all(sql`SELECT * FROM test ORDER BY id`);
		expect(rows).toHaveLength(2);
		expect(rows[0].name).toBe("Alice");
		expect(rows[1].name).toBe("Bob");

		adapter.dispose();
	});

	test("all() returns empty array when no rows", async () => {
		const { db, adapter } = await createDb();

		const rows = await db.all(sql`SELECT * FROM test`);
		expect(rows).toEqual([]);

		adapter.dispose();
	});

	test("first() returns first row", async () => {
		const { db, adapter } = await createDb();
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice')`);

		const row = await db.first(sql`SELECT * FROM test`);
		expect(row.name).toBe("Alice");

		adapter.dispose();
	});

	test("first() throws when no rows", async () => {
		const { db, adapter } = await createDb();

		expect(db.first(sql`SELECT * FROM test`)).rejects.toThrow("Query returned no rows");

		adapter.dispose();
	});

	test("firstOrNull() returns first row when exists", async () => {
		const { db, adapter } = await createDb();
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice')`);

		const row = await db.firstOrNull(sql`SELECT * FROM test`);
		expect(row?.name).toBe("Alice");

		adapter.dispose();
	});

	test("firstOrNull() returns null when no rows", async () => {
		const { db, adapter } = await createDb();

		const row = await db.firstOrNull(sql`SELECT * FROM test`);
		expect(row).toBeNull();

		adapter.dispose();
	});

	test("firstOrFail() returns first row when exists", async () => {
		const { db, adapter } = await createDb();
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice')`);

		const row = await db.firstOrFail(sql`SELECT * FROM test`);
		expect(row.name).toBe("Alice");

		adapter.dispose();
	});

	test("firstOrFail() throws QueryError when no rows", async () => {
		const { db, adapter } = await createDb();

		expect(db.firstOrFail(sql`SELECT * FROM test`)).rejects.toBeInstanceOf(QueryError);

		adapter.dispose();
	});

	test("firstOrNotFound() returns first row when exists", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { app, container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice')`);

		const row = await app.withIntegration(integrationContext(), () =>
			db.firstOrNotFound(sql`SELECT * FROM test`),
		);
		expect(row.name).toBe("Alice");

		adapter.dispose();
	});

	test("firstOrNotFound() throws AbortException when no rows", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { app, container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);

		expect(
			app.withIntegration(integrationContext(), () => db.firstOrNotFound(sql`SELECT * FROM test`)),
		).rejects.toBeInstanceOf(AbortException);

		adapter.dispose();
	});

	test("scalar() returns first column of first row", async () => {
		const { db, adapter } = await createDb();
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice')`);

		const name = await db.scalar(sql`SELECT name FROM test`);
		expect(name).toBe("Alice");

		adapter.dispose();
	});

	test("scalar() throws QueryError when no rows", async () => {
		const { db, adapter } = await createDb();

		expect(db.scalar(sql`SELECT name FROM test`)).rejects.toBeInstanceOf(QueryError);

		adapter.dispose();
	});

	test("column() returns first column of each row", async () => {
		const { db, adapter } = await createDb();
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice'), ('Bob')`);

		const names = await db.column(sql`SELECT name FROM test ORDER BY id`);
		expect(names).toEqual(["Alice", "Bob"]);

		adapter.dispose();
	});

	test("column() returns empty array when no rows", async () => {
		const { db, adapter } = await createDb();

		const names = await db.column(sql`SELECT name FROM test`);
		expect(names).toEqual([]);

		adapter.dispose();
	});
});

describe("Sql class methods", () => {
	test("sql`...`.run() executes via facade", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		createTestApplication({ database: adapter });

		await sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`.run();
		const result = await sql`INSERT INTO test (name) VALUES ('Alice')`.run();
		expect(result.rowsAffected).toBe(1);

		adapter.dispose();
	});

	test("sql`...`.all() executes via facade", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice'), ('Bob')`);

		const rows = await sql`SELECT * FROM test ORDER BY id`.all();
		expect(rows).toHaveLength(2);

		adapter.dispose();
	});

	test("sql`...`.first() executes via facade", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice')`);

		const row = await sql`SELECT * FROM test`.first();
		expect(row.name).toBe("Alice");

		adapter.dispose();
	});

	test("sql`...`.firstOrNull() executes via facade", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);

		const row = await sql`SELECT * FROM test`.firstOrNull();
		expect(row).toBeNull();

		adapter.dispose();
	});

	test("sql`...`.firstOrFail() executes via facade", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);

		expect(sql`SELECT * FROM test`.firstOrFail()).rejects.toBeInstanceOf(QueryError);

		adapter.dispose();
	});

	test("sql`...`.firstOrNotFound() executes via facade", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { app, container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);

		expect(
			app.withIntegration(integrationContext(), () => sql`SELECT * FROM test`.firstOrNotFound()),
		).rejects.toBeInstanceOf(AbortException);

		adapter.dispose();
	});

	test("sql`...`.scalar() executes via facade", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice')`);

		const name = await sql`SELECT name FROM test`.scalar();
		expect(name).toBe("Alice");

		adapter.dispose();
	});

	test("sql`...`.column() executes via facade", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice'), ('Bob')`);

		const names = await sql`SELECT name FROM test ORDER BY id`.column();
		expect(names).toEqual(["Alice", "Bob"]);

		adapter.dispose();
	});

	test("sql`...` is thenable and returns all rows", async () => {
		const adapter = new SqliteDatabaseAdapter({ path: ":memory:" });
		const { container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);
		await db.run(sql`INSERT INTO test (name) VALUES ('Alice'), ('Bob')`);

		const rows = await sql`SELECT * FROM test ORDER BY id`;
		expect(rows).toHaveLength(2);
		expect(rows[0].name).toBe("Alice");
		expect(rows[1].name).toBe("Bob");

		adapter.dispose();
	});
});
