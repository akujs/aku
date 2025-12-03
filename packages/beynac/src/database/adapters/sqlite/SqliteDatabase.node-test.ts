import * as assert from "node:assert";
import { join } from "node:path";
import { test } from "node:test";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { QueryError } from "../../database-errors.ts";
import { sql } from "../../sql.ts";
import { SqliteDatabase } from "./SqliteDatabase.ts";

// IMPORTANT: This file contains basic smoke tests for Node ensuring that the
// database setup and configuration works. The majority of local SQLite database
// tests are in the bun test file. Once we have set up the database, we assume
// that the underlying SQLite implementation works identically on both platforms.

void test("SqliteDatabase works Node.js", async () => {
	const db = new SqliteDatabase({ path: ":memory:" });

	// Test run for DDL
	await db.run(sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`);

	// Test run for INSERT
	const insertResult = await db.run(sql`INSERT INTO users (name) VALUES (${"Alice"})`);
	assert.strictEqual(insertResult.rowsAffected, 1);

	// Test run for SELECT
	const queryResult = await db.run({ sql: "SELECT * FROM users", params: [] });
	assert.deepStrictEqual(queryResult.columnNames, ["id", "name"]);
	assert.strictEqual(queryResult.rows.length, 1);
	assert.strictEqual(queryResult.rows[0].name, "Alice");

	// Test transaction
	await db.transaction(async () => {
		await db.run({ sql: "INSERT INTO users (name) VALUES (?)", params: ["Bob"] });
	});
	const afterTx = await db.run(sql`SELECT COUNT(*) as count FROM users`);
	assert.strictEqual(afterTx.rows[0].count, 2);

	// Test batch
	await db.batch([
		sql`INSERT INTO users (name) VALUES (${"Charlie"})`,
		sql`INSERT INTO users (name) VALUES (${"Diana"})`,
	]);
	const afterBatch = await db.run(sql`SELECT COUNT(*) as count FROM users`);
	assert.strictEqual(afterBatch.rows[0].count, 4);

	db.close();
});

void test("readOnly prevents writes in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-readonly-" });
	const dbPath = join(testDir, "test.db");

	// Create database and add a table
	const db1 = new SqliteDatabase({ path: dbPath });
	await db1.run(sql`CREATE TABLE test (id INTEGER)`);
	db1.close();

	// Reopen as read-only
	const db2 = new SqliteDatabase({ path: dbPath, readOnly: true });
	await assert.rejects(
		db2.run(sql`INSERT INTO test (id) VALUES (1)`),
		"QueryError: SQLITE_READONLY (Attempt to write a readonly database)",
	);
	db2.close();
});

void test("useWalMode enables WAL by default in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-wal-" });
	const dbPath = join(testDir, "test.db");

	const db = new SqliteDatabase({ path: dbPath });
	const result = await db.run(sql`PRAGMA journal_mode`);
	assert.strictEqual(result.rows[0].journal_mode, "wal");
	db.close();
});

void test("useWalMode=false disables WAL in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-nowal-" });
	const dbPath = join(testDir, "test.db");

	const db = new SqliteDatabase({ path: dbPath, useWalMode: false });
	const result = await db.run(sql`PRAGMA journal_mode`);
	assert.strictEqual(result.rows[0].journal_mode, "delete");
	db.close();
});

void test("QueryError captures error code in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-error-" });
	const dbPath = join(testDir, "test.db");

	// Create database and table
	const db1 = new SqliteDatabase({ path: dbPath });
	await db1.run(sql`CREATE TABLE test (id INTEGER)`);
	db1.close();

	// Reopen as read-only and try to write
	const db2 = new SqliteDatabase({ path: dbPath, readOnly: true });
	try {
		await db2.run(sql`INSERT INTO test (id) VALUES (1)`);
		assert.fail("Should have thrown");
	} catch (e) {
		assert.ok(e instanceof QueryError);
		assert.strictEqual(e.code, "SQLITE_READONLY");
		assert.strictEqual(e.errorNumber, 8);
	}
	db2.close();
});
