import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AbortException } from "../http/abort.ts";
import { createTestApplication, mockIntegrationContext } from "../test-utils/http.test-utils.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.test-utils.ts";
import { sqliteDatabase } from "./adapters/sqlite/sqliteDatabase.ts";
import { Database } from "./contracts/Database.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import { DatabaseImpl } from "./DatabaseImpl.ts";
import { QueryError } from "./database-errors.ts";
import { ExecutableStatementImpl } from "./ExecutableStatementImpl.ts";
import { sql } from "./sql.ts";

describe("Sql execution methods", () => {
	let adapter: DatabaseAdapter;

	beforeEach(async () => {
		adapter = sqliteDatabase({ path: ":memory:", transactionRetry: false });
		createTestApplication({ database: adapter });
		await sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`.run();
		await sql`INSERT INTO test (name) VALUES ('Alice'), ('Bob')`.run();
	});

	afterEach(() => {
		adapter.dispose();
	});

	test("run() returns rowsAffected", async () => {
		const result = await sql`INSERT INTO test (name) VALUES ('Charlie')`.run();
		expect(result.rowsAffected).toBe(1);
	});

	test("getAll() returns rows", async () => {
		const rows = await sql`SELECT name FROM test ORDER BY id`.getAll();
		expect(rows).toEqual([{ name: "Alice" }, { name: "Bob" }]);
	});

	test("getFirstOrNull() returns null when no rows", async () => {
		const row = await sql`SELECT * FROM test WHERE name = 'Unknown'`.getFirstOrNull();
		expect(row).toBeNull();
	});

	test("getFirstOrFail() throws QueryError when no rows", async () => {
		expect(sql`SELECT * FROM test WHERE name = 'Unknown'`.getFirstOrFail()).rejects.toBeInstanceOf(
			QueryError,
		);
	});

	test("getScalar() returns first column value", async () => {
		const name = await sql`SELECT name FROM test ORDER BY id`.getScalar();
		expect(name).toBe("Alice");
	});

	test("getColumn() returns first column array", async () => {
		const names = await sql`SELECT name FROM test ORDER BY id`.getColumn();
		expect(names).toEqual(["Alice", "Bob"]);
	});
});

describe(ExecutableStatementImpl.prototype.getFirstOrNotFound, () => {
	let adapter: DatabaseAdapter;

	beforeEach(async () => {
		adapter = sqliteDatabase({ path: ":memory:", transactionRetry: false });
	});

	afterEach(() => {
		adapter.dispose();
	});

	test("throws AbortException when no rows", async () => {
		const { app, container } = createTestApplication({ database: adapter });
		const db = container.get(Database);

		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)`);

		expect(
			app.withIntegration(mockIntegrationContext(), () =>
				sql`SELECT * FROM test`.getFirstOrNotFound(),
			),
		).rejects.toBeInstanceOf(AbortException);
	});
});

describe("client routing", () => {
	let defaultAdapter: DatabaseAdapter;
	let additionalAdapter: DatabaseAdapter;

	beforeEach(async () => {
		defaultAdapter = sqliteDatabase({ path: ":memory:", transactionRetry: false });
		additionalAdapter = sqliteDatabase({ path: ":memory:", transactionRetry: false });

		const defaultDb = new DatabaseImpl(defaultAdapter, mockDispatcher());
		const additionalDb = new DatabaseImpl(additionalAdapter, mockDispatcher());

		await defaultDb.run(sql`CREATE TABLE info (db_name TEXT)`);
		await defaultDb.run(sql`INSERT INTO info (db_name) VALUES ('default')`);

		await additionalDb.run(sql`CREATE TABLE info (db_name TEXT)`);
		await additionalDb.run(sql`INSERT INTO info (db_name) VALUES ('additional')`);
	});

	afterEach(() => {
		defaultAdapter.dispose();
		additionalAdapter.dispose();
	});

	test("on() executes on named client", async () => {
		createTestApplication({
			database: { default: defaultAdapter, additional: { additional: additionalAdapter } },
		});

		const result = await sql`SELECT db_name FROM info`.on("additional").getFirstOrFail();

		expect(result.db_name).toBe("additional");
	});

	test("without on() uses default client", async () => {
		createTestApplication({
			database: { default: defaultAdapter, additional: { additional: additionalAdapter } },
		});

		const result = await sql`SELECT db_name FROM info`.getFirstOrFail();

		expect(result.db_name).toBe("default");
	});
});
