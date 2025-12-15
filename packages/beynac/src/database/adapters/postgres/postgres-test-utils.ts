import postgres, { type Notice } from "postgres";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import type { ExecutableStatement } from "../../ExecutableStatement.ts";
import { sql } from "../../sql.ts";
import { postgresDatabase } from "./postgresDatabase.ts";

export const POSTGRES_URL = "postgres://beynac:beynac@localhost:22857/beynac_test";

export const recreatePostgresPublicSchema: ExecutableStatement = sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public`;

export function createPostgresAdapter(): DatabaseAdapter<unknown> {
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
	dialect: "postgresql",
	createDatabase: createPostgresAdapter,
	supportsTransactions: true,
};
