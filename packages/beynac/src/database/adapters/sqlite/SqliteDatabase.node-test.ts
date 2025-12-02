import * as assert from "node:assert";
import { join } from "node:path";
import { test } from "node:test";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { sql } from "../../sql.ts";
import { SqliteDatabase } from "./SqliteDatabase.ts";

// IMPORTANT: This file contains basic smoke tests for Node ensuring that the
// database setup and configuration works. The majority of local SQLite database
// tests are in the bun test file. Once we have set up the database, we assume
// that the underlying SQLite implementation works identically on both platforms.

void test("SqliteDatabase works Node.js", async () => {
	const db = new SqliteDatabase({ path: ":memory:" });

	// Test execute for DDL
	await db.execute(sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`);

	// Test execute for INSERT
	const insertResult = await db.execute(sql`INSERT INTO users (name) VALUES (${"Alice"})`);
	assert.strictEqual(insertResult.rowsAffected, 1);

	// Test query
	const queryResult = await db.query({ sql: "SELECT * FROM users", params: [] });
	assert.deepStrictEqual(queryResult.columnNames, ["id", "name"]);
	assert.strictEqual(queryResult.rows.length, 1);
	assert.strictEqual(queryResult.rows[0].name, "Alice");

	// Test transaction
	await db.transaction(async () => {
		await db.execute({ sql: "INSERT INTO users (name) VALUES (?)", params: ["Bob"] });
	});
	const afterTx = await db.query(sql`SELECT COUNT(*) as count FROM users`);
	assert.strictEqual(afterTx.rows[0].count, 2);

	// Test batch
	await db.batch([
		sql`INSERT INTO users (name) VALUES (${"Charlie"})`,
		sql`INSERT INTO users (name) VALUES (${"Diana"})`,
	]);
	const afterBatch = await db.query(sql`SELECT COUNT(*) as count FROM users`);
	assert.strictEqual(afterBatch.rows[0].count, 4);

	db.close();
});

void test("readOnly prevents writes in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-readonly-" });
	const dbPath = join(testDir, "test.db");

	// Create database and add a table
	const db1 = new SqliteDatabase({ path: dbPath });
	await db1.execute(sql`CREATE TABLE test (id INTEGER)`);
	db1.close();

	// Reopen as read-only
	const db2 = new SqliteDatabase({ path: dbPath, readOnly: true });
	await assert.rejects(
		db2.execute(sql`INSERT INTO test (id) VALUES (1)`),
		/attempt to write a readonly database/,
	);
	db2.close();
});

void test("useWalMode enables WAL by default in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-wal-" });
	const dbPath = join(testDir, "test.db");

	const db = new SqliteDatabase({ path: dbPath });
	const result = await db.query(sql`PRAGMA journal_mode`);
	assert.strictEqual(result.rows[0].journal_mode, "wal");
	db.close();
});

void test("useWalMode=false disables WAL in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-nowal-" });
	const dbPath = join(testDir, "test.db");

	const db = new SqliteDatabase({ path: dbPath, useWalMode: false });
	const result = await db.query(sql`PRAGMA journal_mode`);
	assert.strictEqual(result.rows[0].journal_mode, "delete");
	db.close();
});
