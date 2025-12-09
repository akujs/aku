import { beforeAll, describe, expect, test } from "bun:test";
import postgres, { type Notice } from "postgres";
import { asyncGate } from "../../../test-utils/async-gate.bun.ts";
import type { Database } from "../../contracts/Database.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { DatabaseImpl } from "../../DatabaseImpl.ts";
import { QueryError } from "../../database-errors.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { sql } from "../../sql.ts";
import { PostgresDatabaseAdapter } from "./PostgresDatabaseAdapter.ts";
import { postgresDatabase } from "./postgresDatabase.ts";

const POSTGRES_URL = "postgres://beynac:beynac@localhost:22857/beynac_test";

async function createAdapter(): Promise<DatabaseAdapter> {
	const sql = postgres(POSTGRES_URL, {
		onnotice: (notice: Notice) => {
			if (notice.severity !== "NOTICE") {
				throw new Error(`Unexpected PostgreSQL ${notice.severity}: ${notice.message}`);
			}
		},
	});

	const adapter = postgresDatabase({ sql });
	await adapter.run(resetSchema);
	return adapter;
}

const resetSchema = sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public`;

export const postgresSharedTestConfig: SharedTestConfig = {
	name: "PostgresDatabase",
	createDatabase: createAdapter,
	supportsTransactions: true,
};

describe(PostgresDatabaseAdapter, () => {
	let db: Database;

	beforeAll(async () => {
		db = new DatabaseImpl(await createAdapter());
	});

	test("uncommitted transaction writes are isolated", async () => {
		await db.run(sql`CREATE TABLE test_isolation (value TEXT)`);
		const gate = asyncGate();

		const txPromise = db.transaction(async () => {
			await db.run(sql`INSERT INTO test_isolation (value) VALUES ('from-tx')`);
			await gate.block();
		});

		await gate.hasBlocked();

		// Read from outside should not see uncommitted write
		const result = await db.run(sql`SELECT * FROM test_isolation`);
		expect(result.rows).toEqual([]);

		gate.release();
		await txPromise;

		const result2 = await db.run(sql`SELECT * FROM test_isolation`);
		expect(result2.rows).toEqual([{ value: "from-tx" }]);
	});

	test("QueryError captures SQLSTATE code", async () => {
		await db.run(sql`CREATE TABLE test_error (id INTEGER PRIMARY KEY)`);
		await db.run(sql`INSERT INTO test_error (id) VALUES (1)`);

		try {
			await db.run(sql`INSERT INTO test_error (id) VALUES (1)`);
			expect.unreachable("Should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(QueryError);
			expect((e as QueryError).code).toBe("23505"); // unique_violation
		}
	});
});
