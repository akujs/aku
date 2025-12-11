import postgres, { type Notice } from "postgres";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { sql } from "../../sql.ts";
import { postgresDatabase } from "./postgresDatabase.ts";

export const POSTGRES_URL = "postgres://beynac:beynac@localhost:22857/beynac_test";

export const resetSchema = sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public`;

export function createPostgresAdapter() {
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
	createDatabase: createPostgresAdapter,
	supportsTransactions: true,
};
