import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import postgres, { type Notice } from "postgres";
import { asyncGate } from "../../../test-utils/async-gate.bun.ts";
import { mockDispatcher } from "../../../test-utils/internal-mocks.bun.ts";
import type { DatabaseClient } from "../../contracts/Database.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { DatabaseClientImpl } from "../../DatabaseClientImpl.ts";
import { QueryError } from "../../database-errors.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { sql } from "../../sql.ts";
import { PostgresDatabaseAdapter } from "./PostgresDatabaseAdapter.ts";
import { postgresDatabase } from "./postgresDatabase.ts";

const POSTGRES_URL = "postgres://beynac:beynac@localhost:22857/beynac_test";

const resetSchema = sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public`;

function createAdapter(): DatabaseAdapter {
	const pgSql = postgres(POSTGRES_URL, {
		onnotice: (notice: Notice) => {
			if (notice.severity !== "NOTICE") {
				throw new Error(`Unexpected PostgreSQL ${notice.severity}: ${notice.message}`);
			}
		},
	});

	return postgresDatabase({ sql: pgSql });
}

export const postgresSharedTestConfig: SharedTestConfig = {
	name: "PostgresDatabase",
	createDatabase: createAdapter,
	supportsTransactions: true,
};

describe(PostgresDatabaseAdapter, () => {
	let db: DatabaseClient;

	beforeAll(async () => {
		const adapter = createAdapter();
		db = new DatabaseClientImpl(adapter, mockDispatcher());
		await db.run(resetSchema);
		await db.run(sql`CREATE TABLE test (value TEXT)`);
	});

	beforeEach(async () => {
		await db.run(sql`DELETE FROM test`);
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
			if (tx1Gate) {
				await tx1Gate.block();
				tx1Gate = null;
			}
			await db.run(sql`UPDATE test SET value = 'tx1'`);
		});

		await tx1Gate!.hasBlocked();

		// TX2: Tries to lock same row with NOWAIT, will fail immediately on first attempt
		const tx2Fn = mock(async () => {
			try {
				await db.run(sql`SELECT * FROM test FOR UPDATE NOWAIT`);
			} catch (e) {
				// After first failure, release TX1 to commit so TX2 can retry successfully
				tx1Gate?.release();
				throw e;
			}
			await db.run(sql`UPDATE test SET value = value || '+tx2'`);
		});
		const tx2Promise = db.transaction(tx2Fn, { retry: { maxAttempts: 3, startingDelay: 0 } });

		await Promise.all([tx1Promise, tx2Promise]);

		expect(tx2Fn.mock.calls.length).toBeGreaterThan(1);
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
				if (gate) {
					await gate.block();
					gate = null;
				}
				await db.run(sql`UPDATE test SET value = ${row.value + "+tx1"}`);
			},
			{ isolation: "serializable" },
		);

		await gate!.hasBlocked();

		// TX2: Also reads and writes, will conflict
		const tx2Fn = mock(async () => {
			const row = await db.first<{ value: string }>(sql`SELECT value FROM test`);
			await db.run(sql`UPDATE test SET value = ${row.value + "+tx2"}`);
		});
		const tx2Promise = db.transaction(tx2Fn, {
			isolation: "serializable",
			retry: { maxAttempts: 3, startingDelay: 0 },
		});

		gate!.release();

		await Promise.all([tx1Promise, tx2Promise]);

		expect(tx2Fn.mock.calls.length).toBeGreaterThan(1);
		const result = await db.scalar<string>(sql`SELECT value FROM test`);
		expect(result).toBe("0+tx1+tx2");
	});

	test("transaction retries on Postgres automatic deadlock detection", async () => {
		await db.run(sql`INSERT INTO test (value) VALUES ('row1'), ('row2')`);

		// Simple signal mechanism for coordinating the deadlock
		let tx1LockedRow1Resolve: (() => void) | null = null;
		let tx2LockedRow2Resolve: (() => void) | null = null;
		let tx1LockedRow1 = new Promise<void>((r) => (tx1LockedRow1Resolve = r));
		let tx2LockedRow2 = new Promise<void>((r) => (tx2LockedRow2Resolve = r));

		// TX1: Lock row1, wait for TX2 to lock row2, then try to lock row2 (deadlock!)
		const tx1Fn = mock(async () => {
			await db.run(sql`SELECT * FROM test WHERE value = 'row1' FOR UPDATE`);
			// Only synchronise on first attempt to create the deadlock
			if (tx1LockedRow1Resolve) {
				tx1LockedRow1Resolve();
				await tx2LockedRow2;
				tx1LockedRow1Resolve = null;
				tx2LockedRow2Resolve = null;
			}
			await db.run(sql`SELECT * FROM test WHERE value = 'row2' FOR UPDATE`);
		});

		// TX2: Wait for TX1 to lock row1, then lock row2, then try to lock row1 (deadlock!)
		const tx2Fn = mock(async () => {
			await tx1LockedRow1;
			await db.run(sql`SELECT * FROM test WHERE value = 'row2' FOR UPDATE`);
			tx2LockedRow2Resolve?.();
			await db.run(sql`SELECT * FROM test WHERE value = 'row1' FOR UPDATE`);
		});

		await Promise.all([
			db.transaction(tx1Fn, { retry: { maxAttempts: 3, startingDelay: 0 } }),
			db.transaction(tx2Fn, { retry: { maxAttempts: 3, startingDelay: 0 } }),
		]);

		// One transaction must have been retried due to deadlock
		expect(tx1Fn.mock.calls.length + tx2Fn.mock.calls.length).toBeGreaterThan(2);
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
});
