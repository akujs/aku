import * as assert from "node:assert";
import { join } from "node:path";
import { test } from "node:test";
import type { Dispatcher } from "../../../core/contracts/Dispatcher.ts";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { DatabaseClientImpl } from "../../DatabaseClientImpl.ts";
import { QueryError } from "../../database-errors.ts";
import { sql } from "../../sql.ts";
import { SqliteDatabaseAdapter } from "./SqliteDatabaseAdapter.ts";

const noopDispatcher: Dispatcher = {
	addListener: () => {},
	removeListener: () => {},
	dispatch: () => {},
	dispatchIfHasListeners: (() => {}) as unknown as Dispatcher["dispatchIfHasListeners"],
};

// IMPORTANT: This file contains basic smoke tests for Node ensuring that the
// database setup and configuration works. The majority of local SQLite database
// tests are in the bun test file. Once we have set up the database, we assume
// that the underlying SQLite implementation works identically on both platforms.

void test("SqliteDatabase works Node.js", async () => {
	const adapter = new SqliteDatabaseAdapter({ path: ":memory:", transactionRetry: false });
	const db = new DatabaseClientImpl(adapter, noopDispatcher);

	// Test run for DDL
	await db.run(sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`);

	// Test run for INSERT
	const insertResult = await db.run(sql`INSERT INTO users (name) VALUES (${"Alice"})`);
	assert.strictEqual(insertResult.rowsAffected, 1);

	// Test run for SELECT
	const queryResult = await db.run(sql`SELECT * FROM users`);
	assert.strictEqual(queryResult.rows.length, 1);
	assert.strictEqual(queryResult.rows[0].name, "Alice");

	// Test transaction
	await db.transaction(async () => {
		await db.run(sql`INSERT INTO users (name) VALUES (${"Bob"})`);
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

	db.dispose();
});

void test("readOnly prevents writes in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-readonly-" });
	const dbPath = join(testDir, "test.db");

	// Create database and add a table
	const adapter1 = new SqliteDatabaseAdapter({ path: dbPath, transactionRetry: false });
	const conn1 = await adapter1.acquireConnection();
	await adapter1.run({
		sql: "CREATE TABLE test (id INTEGER)",
		params: [],
		connection: conn1,
		prepare: undefined,
	});
	adapter1.releaseConnection(conn1);
	adapter1.dispose();

	// Reopen as read-only
	const adapter2 = new SqliteDatabaseAdapter({
		path: dbPath,
		readOnly: true,
		transactionRetry: false,
	});
	const conn2 = await adapter2.acquireConnection();
	await assert.rejects(
		adapter2.run({
			sql: "INSERT INTO test (id) VALUES (1)",
			params: [],
			connection: conn2,
			prepare: undefined,
		}),
		"QueryError: SQLITE_READONLY (Attempt to write a readonly database)",
	);
	adapter2.releaseConnection(conn2);
	adapter2.dispose();
});

void test("useWalMode enables WAL by default in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-wal-" });
	const dbPath = join(testDir, "test.db");

	const adapter = new SqliteDatabaseAdapter({ path: dbPath, transactionRetry: false });
	const conn = await adapter.acquireConnection();
	const result = await adapter.run({
		sql: "PRAGMA journal_mode",
		params: [],
		connection: conn,
		prepare: undefined,
	});
	assert.strictEqual(result.rows[0].journal_mode, "wal");
	adapter.releaseConnection(conn);
	adapter.dispose();
});

void test("useWalMode=false disables WAL in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-nowal-" });
	const dbPath = join(testDir, "test.db");

	const adapter = new SqliteDatabaseAdapter({
		path: dbPath,
		useWalMode: false,
		transactionRetry: false,
	});
	const conn = await adapter.acquireConnection();
	const result = await adapter.run({
		sql: "PRAGMA journal_mode",
		params: [],
		connection: conn,
		prepare: undefined,
	});
	assert.strictEqual(result.rows[0].journal_mode, "delete");
	adapter.releaseConnection(conn);
	adapter.dispose();
});

void test("QueryError captures error code in Node.js", async () => {
	const testDir = createTestDirectory({ prefix: "sqlite-node-error-" });
	const dbPath = join(testDir, "test.db");

	// Create database and table
	const adapter1 = new SqliteDatabaseAdapter({ path: dbPath, transactionRetry: false });
	const conn1 = await adapter1.acquireConnection();
	await adapter1.run({
		sql: "CREATE TABLE test (id INTEGER)",
		params: [],
		connection: conn1,
		prepare: undefined,
	});
	adapter1.releaseConnection(conn1);
	adapter1.dispose();

	// Reopen as read-only and try to write
	const adapter2 = new SqliteDatabaseAdapter({
		path: dbPath,
		readOnly: true,
		transactionRetry: false,
	});
	const conn2 = await adapter2.acquireConnection();
	try {
		await adapter2.run({
			sql: "INSERT INTO test (id) VALUES (1)",
			params: [],
			connection: conn2,
			prepare: undefined,
		});
		assert.fail("Should have thrown");
	} catch (e) {
		assert.ok(e instanceof QueryError);
		assert.strictEqual(e.code, "SQLITE_READONLY");
		assert.strictEqual(e.errorNumber, 8);
	}
	adapter2.releaseConnection(conn2);
	adapter2.dispose();
});
