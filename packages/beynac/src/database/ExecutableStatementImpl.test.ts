import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AbortException } from "../http/abort.ts";
import {
	createTestApplication,
	mockIntegrationContext,
} from "../test-utils/http-test-utils.bun.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
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

	test("all() returns rows", async () => {
		const rows = await sql`SELECT name FROM test ORDER BY id`.all();
		expect(rows).toEqual([{ name: "Alice" }, { name: "Bob" }]);
	});

	test("first() returns first row", async () => {
		const row = await sql`SELECT * FROM test ORDER BY id`.first();
		expect(row.name).toBe("Alice");
	});

	test("firstOrNull() returns null when no rows", async () => {
		const row = await sql`SELECT * FROM test WHERE name = 'Unknown'`.firstOrNull();
		expect(row).toBeNull();
	});

	test("firstOrFail() throws QueryError when no rows", async () => {
		expect(sql`SELECT * FROM test WHERE name = 'Unknown'`.firstOrFail()).rejects.toBeInstanceOf(
			QueryError,
		);
	});

	test("scalar() returns first column value", async () => {
		const name = await sql`SELECT name FROM test ORDER BY id`.scalar();
		expect(name).toBe("Alice");
	});

	test("column() returns first column array", async () => {
		const names = await sql`SELECT name FROM test ORDER BY id`.column();
		expect(names).toEqual(["Alice", "Bob"]);
	});

	test("is thenable and returns all rows", async () => {
		const rows = await sql`SELECT name FROM test ORDER BY id`;
		expect(rows).toEqual([{ name: "Alice" }, { name: "Bob" }]);
	});
});

describe(ExecutableStatementImpl.prototype.firstOrNotFound, () => {
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
				sql`SELECT * FROM test`.firstOrNotFound(),
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

		const result = await sql`SELECT db_name FROM info`
			.on("additional")
			.first<{ db_name: string }>();

		expect(result.db_name).toBe("additional");
	});

	test("without on() uses default client", async () => {
		createTestApplication({
			database: { default: defaultAdapter, additional: { additional: additionalAdapter } },
		});

		const result = await sql`SELECT db_name FROM info`.first<{ db_name: string }>();

		expect(result.db_name).toBe("default");
	});

	test("await sql`...`.on() runs all() on named client", async () => {
		createTestApplication({
			database: { default: defaultAdapter, additional: { additional: additionalAdapter } },
		});

		const rows = await sql`SELECT db_name FROM info`.on("additional");

		expect(rows).toEqual([{ db_name: "additional" }]);
	});
});
