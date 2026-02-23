import postgres, { type Notice, type Sql } from "postgres";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import type { ExecutableStatement } from "../../query-types.ts";
import { sql } from "../../sql.ts";
import { postgresDatabase } from "./postgresDatabase.ts";

const POSTGRES_URL = "postgres://aku:aku@localhost:22857/aku_test";

export const recreatePostgresPublicSchema: ExecutableStatement = sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public`;

const TEST_LOCK_KEY = 948572;
const LOCK_TIMEOUT_MS = 10_000;
let sharedPool: Sql | null = null;

export async function getSharedPostgresJsClient(): Promise<Sql> {
	if (sharedPool) return sharedPool;

	sharedPool = postgres(POSTGRES_URL, {
		onnotice: (notice: Notice) => {
			if (notice.severity !== "NOTICE") {
				throw new Error(`Unexpected PostgreSQL ${notice.severity}: ${notice.message}`);
			}
		},
	});

	// Prevent postgres tests running concurrently as they share the same schema
	const lockConnection = await sharedPool.reserve();
	await Promise.race([
		lockConnection`SELECT pg_advisory_lock(${TEST_LOCK_KEY})`,
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new Error(
							"Another test process has been using the postgres database for 10+ seconds, which wait for it to finish or check for stuck processes.",
						),
					),
				LOCK_TIMEOUT_MS,
			),
		),
	]);

	return sharedPool;
}

export async function createPostgresAdapter(): Promise<DatabaseAdapter<unknown>> {
	return postgresDatabase({
		sql: await getSharedPostgresJsClient(),
		transactionRetry: false,
	});
}

export const postgresSharedTestConfig: SharedTestConfig = {
	name: "PostgresDatabase",
	dialect: "postgresql",
	createDatabase: createPostgresAdapter,
	supportsTransactions: true,
};
