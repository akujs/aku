import { beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Sql } from "postgres";
import { asyncGate } from "../../../test-utils/async-gate.bun.ts";
import { type MockDispatcher, mockDispatcher } from "../../../test-utils/internal-mocks.bun.ts";
import type { DatabaseClient } from "../../DatabaseClient.ts";
import { DatabaseClientImpl } from "../../DatabaseClientImpl.ts";
import { QueryError } from "../../database-errors.ts";
import { TransactionRetryingEvent } from "../../database-events.ts";
import { sql } from "../../sql.ts";
import { PostgresDatabaseAdapter } from "./PostgresDatabaseAdapter.ts";
import {
	createPostgresAdapter,
	getSharedPostgresJsClient,
	recreatePostgresPublicSchema,
} from "./postgres-test-utils.ts";

describe(PostgresDatabaseAdapter, () => {
	let db: DatabaseClient;
	let adapter: PostgresDatabaseAdapter;
	let dispatcher: MockDispatcher;
	let postgresJs: Sql;

	beforeAll(async () => {
		postgresJs = await getSharedPostgresJsClient();
		adapter = (await createPostgresAdapter()) as PostgresDatabaseAdapter;
		dispatcher = mockDispatcher();
		db = new DatabaseClientImpl(adapter, dispatcher);

		await db.run(recreatePostgresPublicSchema);
		await db.run(sql`CREATE TABLE test (value TEXT)`);
	});

	beforeEach(async () => {
		await db.run(sql`DELETE FROM test`);
		dispatcher.clear();
	});

	test("uncommitted transaction writes are isolated", async () => {
		const gate = asyncGate();

		const txPromise = db.transaction(async () => {
			await db.run(sql`INSERT INTO test (value) VALUES ('from-tx')`);
			await gate.block();
		});

		await gate.hasBlocked();

		// Read from outside should not see uncommitted write
		const result = await db.run(sql`SELECT * FROM test`);
		expect(result.rows).toEqual([]);

		gate.release();
		await txPromise;

		const result2 = await db.run(sql`SELECT * FROM test`);
		expect(result2.rows).toEqual([{ value: "from-tx" }]);
	});

	test("transaction retries on row lock contention", async () => {
		await db.run(sql`INSERT INTO test (value) VALUES ('0')`);

		let tx1Gate: ReturnType<typeof asyncGate> | null = asyncGate();

		// TX1: Acquires lock, blocks at gate until released, then commits
		const tx1Promise = db.transaction(async () => {
			await db.run(sql`SELECT * FROM test FOR UPDATE`);
			await tx1Gate?.block();
			await db.run(sql`UPDATE test SET value = 'tx1'`);
		});

		await tx1Gate!.hasBlocked();

		// TX2: Tries to lock same row with NOWAIT, will fail immediately on first attempt
		const tx2Promise = db.transaction(
			async () => {
				try {
					await db.run(sql`SELECT * FROM test FOR UPDATE NOWAIT`);
				} catch (e) {
					// After first failure, release TX1 to commit so TX2 can retry successfully
					await tx1Gate?.releaseAndWaitTick();
					throw e;
				}
				await db.run(sql`UPDATE test SET value = value || '+tx2'`);
			},
			{ retry: { maxAttempts: 3, startingDelay: 0 } },
		);

		await Promise.all([tx1Promise, tx2Promise]);

		const retryEvents = dispatcher.getEvents(TransactionRetryingEvent);
		expect(retryEvents).toHaveLength(1);
		expect(retryEvents[0].error?.toString()).toInclude("55P03: could not obtain lock");

		const result = await db.scalar<string>(sql`SELECT value FROM test`);
		expect(result).toBe("tx1+tx2");
	});

	test("transaction retries on serializable write conflict", async () => {
		await db.run(sql`INSERT INTO test (value) VALUES ('0')`);

		let gate: ReturnType<typeof asyncGate> | null = asyncGate();

		// TX1: Reads then writes
		const tx1Promise = db.transaction(
			async () => {
				const row = await db.first<{ value: string }>(sql`SELECT value FROM test`);
				await gate?.block();
				gate = null;
				await db.run(sql`UPDATE test SET value = ${row.value + "+tx1"}`);
			},
			{ isolation: "serializable" },
		);

		await gate!.hasBlocked();

		// TX2: Also reads and writes, will conflict
		const tx2Promise = db.transaction(
			async () => {
				const row = await db.first<{ value: string }>(sql`SELECT value FROM test`);
				await db.run(sql`UPDATE test SET value = ${row.value + "+tx2"}`);
			},
			{
				isolation: "serializable",
				retry: { maxAttempts: 3, startingDelay: 0 },
			},
		);

		gate!.release();

		await Promise.all([tx1Promise, tx2Promise]);

		const retryEvents = dispatcher.getEvents(TransactionRetryingEvent);
		expect(retryEvents).toHaveLength(1);
		expect(retryEvents[0].error?.toString()).toInclude("40001: could not serialize access");

		const result = await db.scalar<string>(sql`SELECT value FROM test`);
		expect(result).toBe("0+tx1+tx2");
	});

	test("transaction retries on Postgres automatic deadlock detection", async () => {
		await db.run(sql`INSERT INTO test (value) VALUES ('row1'), ('row2')`);

		let gate1: ReturnType<typeof asyncGate> | null = asyncGate();
		let gate2: ReturnType<typeof asyncGate> | null = asyncGate();

		const promise = Promise.all([
			// TX1: Lock row1, block, then try to lock row2 (deadlock!)
			db.transaction(
				async () => {
					await db.run(sql`SELECT * FROM test WHERE value = 'row1' FOR UPDATE`);
					await gate1?.block();
					await db.run(sql`SELECT * FROM test WHERE value = 'row2' FOR UPDATE`);
				},
				{ retry: { maxAttempts: 3, startingDelay: 0 } },
			),
			// TX2: Lock row2, block, then try to lock row1 (deadlock!)
			db.transaction(
				async () => {
					await db.run(sql`SELECT * FROM test WHERE value = 'row2' FOR UPDATE`);
					await gate2?.block();
					await db.run(sql`SELECT * FROM test WHERE value = 'row1' FOR UPDATE`);
				},
				{ retry: { maxAttempts: 3, startingDelay: 0 } },
			),
		]);

		// Wait for both to acquire their first locks
		await gate1!.hasBlocked();
		await gate2!.hasBlocked();

		// Release both to proceed to deadlock
		gate1!.release();
		gate2!.release();
		gate1 = null;
		gate2 = null;

		await promise;

		// One transaction must have been retried due to deadlock
		const retryEvents = dispatcher.getEvents(TransactionRetryingEvent);
		expect(retryEvents).toHaveLength(1);
		expect(retryEvents[0].error?.toString()).toInclude("40P01: deadlock detected");
	});

	test("QueryError captures SQLSTATE code", async () => {
		await db.run(sql`INSERT INTO test (value) VALUES ('a')`);
		await db.run(sql`CREATE UNIQUE INDEX test_value_unique ON test (value)`);

		try {
			await db.run(sql`INSERT INTO test (value) VALUES ('a')`);
			expect.unreachable("Should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(QueryError);
			expect((e as QueryError).code).toBe("23505"); // unique_violation
		}
	});

	describe("prepare option", () => {
		let unsafeMock: ReturnType<typeof spyOn>;
		beforeEach(async () => {
			const connection = await postgresJs.reserve();

			unsafeMock = spyOn(connection, "unsafe").mockResolvedValue([] as never);
			spyOn(postgresJs, "reserve").mockResolvedValue(connection);
		});

		const getSqlAndPrepare = () =>
			(unsafeMock.mock.calls as [string, unknown[], { prepare: boolean }][]).map((call) => [
				call[0],
				call[2].prepare,
			]);

		test("uses adapter default prepare: true", async () => {
			await db.all(sql`SELECT 1`);
			expect(getSqlAndPrepare()).toEqual([["SELECT 1", true]]);
		});

		test("respects adapter config for prepare: false", async () => {
			const customAdapter = new PostgresDatabaseAdapter({
				sql: postgresJs,
				transactionRetry: false,
				prepare: false,
			});
			const client = new DatabaseClientImpl(customAdapter, mockDispatcher());

			await client.all(sql`SELECT 1`);
			expect(getSqlAndPrepare()).toEqual([["SELECT 1", false]]);
		});

		test("withPrepare(false) on sql tag overrides adapter default", async () => {
			await db.all(sql`SELECT 1`.withPrepare(false));
			expect(getSqlAndPrepare()).toEqual([["SELECT 1", false]]);
		});

		test("withPrepare(false) on query builder overrides adapter default", async () => {
			await db.table("test").select("1").withPrepare(false);
			expect(getSqlAndPrepare()).toEqual([['SELECT 1 FROM "test"', false]]);
		});

		test("batch respects per-statement prepare values", async () => {
			await db.batch([
				sql`SELECT 1`.withPrepare(true),
				sql`SELECT 2`.withPrepare(false),
				sql`SELECT 3`,
			]);
			expect(getSqlAndPrepare()).toEqual([
				["BEGIN", false],
				["SELECT 1", true],
				["SELECT 2", false],
				["SELECT 3", true],
				["COMMIT", false],
			]);
		});

		test("prepare option is respected with run()", async () => {
			await db.run(sql`SELECT 1`.withPrepare(false));
			expect(getSqlAndPrepare()).toEqual([["SELECT 1", false]]);
		});
	});
});
