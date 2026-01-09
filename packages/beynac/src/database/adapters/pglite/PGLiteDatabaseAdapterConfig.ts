import type { PGlite } from "@electric-sql/pglite";

/***/
export interface PGLiteDatabaseAdapterConfig {
	/**
	 * An existing PGlite instance to use. If not provided, creates an in-memory database.
	 */
	db?: PGlite | undefined;
}
