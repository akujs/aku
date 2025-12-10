import { createTypeToken, type TypeToken } from "../../container/container-key.ts";
import type { DatabaseClient } from "../DatabaseClient.ts";

export type { DatabaseClient } from "../DatabaseClient.ts";
export type { Row, Statement, StatementResult } from "../Statement.ts";

/**
 * A manager for database clients.
 *
 * Query methods like all() can be used directly on this object and will be
 * executed on the default client.
 */
export interface Database extends DatabaseClient {
	/**
	 * Get a database client by name. If no name is provided, the default
	 * client is returned.
	 */
	client(name?: string): DatabaseClient;
}

export const Database: TypeToken<Database> = createTypeToken("Database");
