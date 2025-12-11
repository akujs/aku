import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { type MockDispatcher, mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
import { mockCurrentTime, resetMockTime } from "../testing/mock-time.ts";
import { sqliteDatabase } from "./adapters/sqlite/sqliteDatabase.ts";
import type { DatabaseAdapter } from "./DatabaseAdapter.ts";
import type { DatabaseClient } from "./DatabaseClient.ts";
import { DatabaseClientImpl } from "./DatabaseClientImpl.ts";
import { QueryError } from "./database-errors.ts";
import {
	QueryExecutedEvent,
	QueryExecutingEvent,
	TransactionExecutedEvent,
	type TransactionExecutingEvent,
	TransactionFailedEvent,
	TransactionPreCommitEvent,
} from "./database-events.ts";
import { sql } from "./sql.ts";

describe("database events", () => {
	let adapter: DatabaseAdapter;
	let dispatcher: MockDispatcher;
	let db: DatabaseClient;

	beforeEach(async () => {
		adapter = sqliteDatabase({ path: ":memory:" });
		dispatcher = mockDispatcher();
		db = new DatabaseClientImpl(adapter, dispatcher);
		await db.run(sql`CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)`);
		dispatcher.clear();
	});

	afterEach(() => {
		resetMockTime();
		db.dispose();
	});

	describe("query events", () => {
		test("run() dispatches QueryExecuting and QueryExecuted events", async () => {
			const statement = sql`INSERT INTO test (value) VALUES ('hello')`;

			const result = await db.run(statement);

			const events = dispatcher.getEvents();
			expect(events).toHaveLength(2);
			expect(events).toEqual([
				expect.objectContaining({
					type: "query:execute",
					phase: "start",
					statement,
					transactionId: null,
					transactionDepth: 0,
				}),
				expect.objectContaining({
					type: "query:execute",
					phase: "complete",
					statement,
					result,
					transactionId: null,
					transactionDepth: 0,
				}),
			]);
		});

		test("run() dispatches QueryExecuting and QueryFailed events on error", async () => {
			const statement = sql`INSERT INTO nonexistent_table (value) VALUES ('hello')`;

			expect(db.run(statement)).rejects.toThrow();

			const events = dispatcher.getEvents();
			expect(events).toHaveLength(2);
			expect(events).toEqual([
				expect.objectContaining({
					type: "query:execute",
					phase: "start",
					statement,
				}),
				expect.objectContaining({
					type: "query:execute",
					phase: "fail",
					statement,
					error: expect.anything(),
				}),
			]);
		});

		test("query events timeTakenMs reflects duration", async () => {
			mockCurrentTime(1000);
			const originalRun = adapter.run.bind(adapter);
			spyOn(adapter, "run").mockImplementation(async (statement, connection) => {
				mockCurrentTime(1075);
				return originalRun(statement, connection);
			});

			await db.run(sql`SELECT 1`);

			const endEvent = dispatcher.getEvents(QueryExecutedEvent)[0];
			expect(endEvent.timeTakenMs).toBe(75);
		});
	});

	describe("transaction events", () => {
		test("successful transaction dispatches begin, commit events", async () => {
			await db.transaction(async () => {
				await db.run(sql`INSERT INTO test (value) VALUES ('hello')`);
			});

			const events = dispatcher.getEvents();
			const txId = (events[0] as TransactionExecutingEvent).transactionId;

			expect(events).toEqual([
				expect.objectContaining({
					type: "transaction:execute",
					phase: "start",
					transactionId: txId,
					outerTransactionId: txId,
					transactionDepth: 1,
				}),
				expect.objectContaining({
					type: "query:execute",
					phase: "start",
					transactionId: txId,
					outerTransactionId: txId,
					transactionDepth: 1,
				}),
				expect.objectContaining({
					type: "query:execute",
					phase: "complete",
					transactionId: txId,
					outerTransactionId: txId,
					transactionDepth: 1,
				}),
				expect.objectContaining({
					type: "transaction:pre-commit",
					transactionId: txId,
					outerTransactionId: txId,
					transactionDepth: 1,
				}),
				expect.objectContaining({
					type: "transaction:execute",
					phase: "complete",
					transactionId: txId,
					outerTransactionId: txId,
					transactionDepth: 1,
				}),
			]);
		});

		test("failed transaction dispatches begin and rollback events", async () => {
			const testError = new Error("test error");

			expect(
				db.transaction(async () => {
					await db.run(sql`INSERT INTO test (value) VALUES ('hello')`);
					throw testError;
				}),
			).rejects.toThrow(testError);

			const events = dispatcher.getEvents();
			const txId = (events[0] as TransactionExecutingEvent).transactionId;

			expect(events).toEqual([
				expect.objectContaining({
					type: "transaction:execute",
					phase: "start",
					transactionId: txId,
					transactionDepth: 1,
				}),
				expect.objectContaining({ type: "query:execute", phase: "start" }),
				expect.objectContaining({ type: "query:execute", phase: "complete" }),
				expect.objectContaining({
					type: "transaction:execute",
					phase: "fail",
					transactionId: txId,
					error: testError,
				}),
			]);
		});

		test("nested transaction has correct depth in events", async () => {
			await db.transaction(async () => {
				await db.transaction(async () => {
					await db.run(sql`INSERT INTO test (value) VALUES ('nested')`);
				});
			});

			const events = dispatcher.getEvents();
			const outerTxId = (events[0] as TransactionExecutingEvent).transactionId;
			const innerTxId = (events[1] as TransactionExecutingEvent).transactionId;

			expect(events.slice(0, 3)).toEqual([
				expect.objectContaining({
					type: "transaction:execute",
					transactionId: outerTxId,
					outerTransactionId: outerTxId,
					transactionDepth: 1,
				}),
				expect.objectContaining({
					type: "transaction:execute",
					transactionId: innerTxId,
					outerTransactionId: outerTxId,
					transactionDepth: 2,
				}),
				expect.objectContaining({
					type: "query:execute",
					phase: "start",
					transactionId: innerTxId,
					outerTransactionId: outerTxId,
					transactionDepth: 2,
				}),
			]);
		});

		test("transaction commit timeTakenMs reflects duration", async () => {
			mockCurrentTime(1000);

			await db.transaction(async () => {
				mockCurrentTime(1250);
			});

			const executedEvent = dispatcher.getEvents(TransactionExecutedEvent)[0];
			expect(executedEvent.timeTakenMs).toBe(250);
		});

		test("transaction rollback timeTakenMs reflects duration", async () => {
			mockCurrentTime(2000);

			expect(
				db.transaction(async () => {
					mockCurrentTime(2100);
					throw new Error("test");
				}),
			).rejects.toThrow();

			const failedEvent = dispatcher.getEvents(TransactionFailedEvent)[0];
			expect(failedEvent.timeTakenMs).toBe(100);
		});

		test("transaction retry dispatches correct event sequence", async () => {
			// Force a retry by making first BEGIN fail with SQLITE_BUSY
			let beginAttempts = 0;
			const originalRun = adapter.run.bind(adapter);
			spyOn(adapter, "run").mockImplementation(async (stmt, conn) => {
				if (stmt.renderForLogs() === "BEGIN" && beginAttempts++ === 0) {
					throw new QueryError("BEGIN", "database is locked", undefined, "SQLITE_BUSY", 5);
				}
				return originalRun(stmt, conn);
			});

			await db.transaction(
				async () => {
					await db.run(sql`INSERT INTO test (value) VALUES ('hello')`);
				},
				{ retry: { maxAttempts: 3 } },
			);

			const events = dispatcher.getEvents();
			const tx1Id = (events[0] as TransactionExecutingEvent).transactionId;
			const tx2Id = (events[2] as TransactionExecutingEvent).transactionId;

			expect(events).toEqual([
				// Attempt 1: BEGIN fails (no rollback since transaction never started in DB)
				expect.objectContaining({
					type: "transaction:execute",
					phase: "start",
					transactionId: tx1Id,
					outerTransactionId: tx1Id,
					transactionDepth: 1,
				}),
				// Retry event before attempt 2
				expect.objectContaining({
					type: "transaction:retry",
					attempt: 2,
					previousTransactionId: tx1Id,
					error: expect.any(QueryError),
				}),
				// Attempt 2: succeeds
				expect.objectContaining({
					type: "transaction:execute",
					phase: "start",
					transactionId: tx2Id,
					outerTransactionId: tx2Id,
					transactionDepth: 1,
				}),
				expect.objectContaining({ type: "query:execute", phase: "start" }),
				expect.objectContaining({ type: "query:execute", phase: "complete" }),
				expect.objectContaining({
					type: "transaction:pre-commit",
					transactionId: tx2Id,
					outerTransactionId: tx2Id,
					transactionDepth: 1,
				}),
				expect.objectContaining({
					type: "transaction:execute",
					phase: "complete",
					transactionId: tx2Id,
					outerTransactionId: tx2Id,
					transactionDepth: 1,
				}),
			]);

			expect(tx2Id).not.toBe(tx1Id);
		});

		test("nested transaction ignores retry options", async () => {
			let attempts = 0;

			expect(
				db.transaction(async () => {
					await db.transaction(
						async () => {
							attempts++;
							throw new QueryError("test", "database is locked", undefined, "SQLITE_BUSY", 5);
						},
						{ retry: { maxAttempts: 3 } },
					);
				}),
			).rejects.toThrow("database is locked");

			// If retry was active, attempts would be > 1
			expect(attempts).toBe(1);

			// Note: no "transaction:retry" event - retry is ignored for nested transactions
			expect(dispatcher.getEvents()).toEqual([
				expect.objectContaining({
					type: "transaction:execute",
					phase: "start",
				}),
				expect.objectContaining({
					type: "transaction:execute",
					phase: "start",
				}),
				expect.objectContaining({
					type: "transaction:execute",
					phase: "fail",
				}),
				expect.objectContaining({
					type: "transaction:execute",
					phase: "fail",
				}),
			]);
		});

		test("concurrent nested transactions should be serialised, not interleaved", async () => {
			await db.transaction(async () => {
				// Spawn two nested transactions concurrently
				await Promise.all([
					db.transaction(async () => {
						await db.run(sql`INSERT INTO test (value) VALUES ('tx1-a')`);
						await db.run(sql`INSERT INTO test (value) VALUES ('tx1-b')`);
						await db.run(sql`INSERT INTO test (value) VALUES ('tx1-c')`);
					}),
					db.transaction(async () => {
						await db.run(sql`INSERT INTO test (value) VALUES ('tx2-a')`);
						await db.run(sql`INSERT INTO test (value) VALUES ('tx2-b')`);
						await db.run(sql`INSERT INTO test (value) VALUES ('tx2-c')`);
					}),
				]);
			});

			// Extract the INSERT statements from executed queries
			const inserts = dispatcher
				.getEvents()
				.filter((e): e is QueryExecutingEvent => e instanceof QueryExecutingEvent)
				.map((e) => e.statement.renderForLogs())
				.filter((s) => s.startsWith("INSERT"));

			// The SQL should be serialised - tx1 fully completes before tx2 starts
			expect(inserts).toEqual([
				"INSERT INTO test (value) VALUES ('tx1-a')",
				"INSERT INTO test (value) VALUES ('tx1-b')",
				"INSERT INTO test (value) VALUES ('tx1-c')",
				"INSERT INTO test (value) VALUES ('tx2-a')",
				"INSERT INTO test (value) VALUES ('tx2-b')",
				"INSERT INTO test (value) VALUES ('tx2-c')",
			]);
		});

		test("deeply nested concurrent transactions should be serialised at each level", async () => {
			await db.transaction(async () => {
				// Level 2: two concurrent transactions
				await Promise.all([
					db.transaction(async () => {
						await db.run(sql`INSERT INTO test (value) VALUES ('L2-tx1')`);
						// Level 3: two concurrent transactions inside first level-2 tx
						await Promise.all([
							db.transaction(async () => {
								await db.run(sql`INSERT INTO test (value) VALUES ('L3-tx1a')`);
								await db.run(sql`INSERT INTO test (value) VALUES ('L3-tx1b')`);
							}),
							db.transaction(async () => {
								await db.run(sql`INSERT INTO test (value) VALUES ('L3-tx2a')`);
								await db.run(sql`INSERT INTO test (value) VALUES ('L3-tx2b')`);
							}),
						]);
					}),
					db.transaction(async () => {
						await db.run(sql`INSERT INTO test (value) VALUES ('L2-tx2')`);
						// Level 3: two concurrent transactions inside second level-2 tx
						await Promise.all([
							db.transaction(async () => {
								await db.run(sql`INSERT INTO test (value) VALUES ('L3-tx3a')`);
								await db.run(sql`INSERT INTO test (value) VALUES ('L3-tx3b')`);
							}),
							db.transaction(async () => {
								await db.run(sql`INSERT INTO test (value) VALUES ('L3-tx4a')`);
								await db.run(sql`INSERT INTO test (value) VALUES ('L3-tx4b')`);
							}),
						]);
					}),
				]);
			});

			const inserts = dispatcher
				.getEvents()
				.filter((e): e is QueryExecutingEvent => e instanceof QueryExecutingEvent)
				.map((e) => e.statement.renderForLogs())
				.filter((s) => s.startsWith("INSERT"));

			// Level 2 transactions serialise: tx1 completes fully before tx2 starts
			// Within each level 2, level 3 transactions also serialise
			expect(inserts).toEqual([
				"INSERT INTO test (value) VALUES ('L2-tx1')",
				"INSERT INTO test (value) VALUES ('L3-tx1a')",
				"INSERT INTO test (value) VALUES ('L3-tx1b')",
				"INSERT INTO test (value) VALUES ('L3-tx2a')",
				"INSERT INTO test (value) VALUES ('L3-tx2b')",
				"INSERT INTO test (value) VALUES ('L2-tx2')",
				"INSERT INTO test (value) VALUES ('L3-tx3a')",
				"INSERT INTO test (value) VALUES ('L3-tx3b')",
				"INSERT INTO test (value) VALUES ('L3-tx4a')",
				"INSERT INTO test (value) VALUES ('L3-tx4b')",
			]);
		});

		test("throwing from pre-commit listener rolls back the transaction", async () => {
			const listenerError = new Error("listener abort");

			dispatcher.addListener(TransactionPreCommitEvent, () => {
				throw listenerError;
			});

			expect(
				db.transaction(async () => {
					await db.run(sql`INSERT INTO test (value) VALUES ('should-rollback')`);
				}),
			).rejects.toThrow(listenerError);

			// Verify the insert was rolled back
			const rows = await db.all(sql`SELECT * FROM test`);
			expect(rows).toEqual([]);

			// Verify failed event was dispatched
			expect(dispatcher.getEvents(TransactionFailedEvent)).toHaveLength(1);
		});
	});
});
