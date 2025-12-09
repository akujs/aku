import { createTypeToken, type TypeToken } from "../../container/container-key.ts";
import type { DatabaseConnection } from "../DatabaseConnection.ts";

export type { DatabaseConnection } from "../DatabaseConnection.ts";
export type { Row, Statement, StatementResult } from "../Statement.ts";

/**
 * A manager for database connections.
 *
 * Query methods like all() can be used directly on this object and will be
 * executed on the default connection.
 */
export interface Database extends DatabaseConnection {
	/**
	 * Get a database connection by name. If no name is provided, the default
	 * connection is returned.
	 */
	connection(name?: string): DatabaseConnection;
}

export const Database: TypeToken<Database> = createTypeToken("Database");
