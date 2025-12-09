import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { PGLiteDatabaseAdapter } from "./PGLiteDatabaseAdapter.ts";
import type { PGLiteDatabaseAdapterConfig } from "./PGLiteDatabaseAdapterConfig.ts";

/**
 * Configure a PGLite database adapter
 *
 * With no configuration, this will create an in-memory database. To specify
 * more configuration, pass a configured PGlite instance.
 *
 * @example
 * createApplication({
 *   database: pgliteDatabase({
 *     db: new PGlite({ ... pglite configuration ... })
 *   }),
 *   ...
 * });
 */
export function pgliteDatabase(config: PGLiteDatabaseAdapterConfig = {}): DatabaseAdapter {
	return new PGLiteDatabaseAdapter(config);
}
