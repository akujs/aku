import { describe, expect, test } from "bun:test";
import { DatabaseError, QueryError } from "./database-errors.ts";

describe(DatabaseError, () => {
	describe("code-based detection", () => {
		test("detects PostgreSQL serialization failure (40001)", () => {
			const error = new QueryError("SELECT 1", "serialization_failure", null, "40001");
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects PostgreSQL deadlock (40P01)", () => {
			const error = new QueryError("SELECT 1", "deadlock_detected", null, "40P01");
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects PostgreSQL lock not available (55P03)", () => {
			const error = new QueryError("SELECT 1", "lock_not_available", null, "55P03");
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects SQLite busy (SQLITE_BUSY)", () => {
			const error = new QueryError("SELECT 1", "database is busy", null, "SQLITE_BUSY", 5);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("doesn't match unrelated codes", () => {
			const error = new QueryError("SELECT 1", "syntax error", null, "42601");
			expect(error.isConcurrencyError()).toBe(false);
		});
	});

	describe("message-based detection", () => {
		test("detects MySQL deadlock message", () => {
			const error = new QueryError(
				"SELECT 1",
				"Deadlock found when trying to get lock; try restarting transaction",
				null,
			);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects PostgreSQL deadlock message", () => {
			const error = new QueryError("SELECT 1", "ERROR: deadlock detected", null);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects SQLite database locked message", () => {
			const error = new QueryError("SELECT 1", "database is locked", null);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects SQLite file locked message", () => {
			const error = new QueryError("SELECT 1", "The database file is locked", null);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects SQLite table locked message", () => {
			const error = new QueryError("SELECT 1", "database table is locked", null);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects alternative table locked message", () => {
			const error = new QueryError("SELECT 1", "A table in the database is locked", null);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects SQL Server deadlock victim message", () => {
			const error = new QueryError(
				"SELECT 1",
				"Transaction was deadlocked on lock resources with another process and has been chosen as the deadlock victim",
				null,
			);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects MySQL lock wait timeout message", () => {
			const error = new QueryError(
				"SELECT 1",
				"Lock wait timeout exceeded; try restarting transaction",
				null,
			);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("detects MariaDB WSREP deadlock message", () => {
			const error = new QueryError(
				"SELECT 1",
				"WSREP detected deadlock/conflict and aborted the transaction. Try restarting the transaction",
				null,
			);
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("doesn't match unrelated messages", () => {
			const error = new QueryError("SELECT 1", "syntax error at or near SELECT", null);
			expect(error.isConcurrencyError()).toBe(false);
		});
	});

	describe("on base DatabaseError", () => {
		test("detects concurrency error by message", () => {
			const error = new DatabaseError("database is locked");
			expect(error.isConcurrencyError()).toBe(true);
		});

		test("doesn't match unrelated messages", () => {
			const error = new DatabaseError("Connection refused");
			expect(error.isConcurrencyError()).toBe(false);
		});
	});
});
