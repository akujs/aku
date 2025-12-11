import type { ExecutableStatement } from "./ExecutableStatement.ts";
import { ExecutableStatementImpl } from "./ExecutableStatementImpl.ts";

export interface SqlApi {
	(strings: TemplateStringsArray, ...values: unknown[]): ExecutableStatement;
	raw(sqlString: string): ExecutableStatement;
}

/**
 * Template literal for creating SQL statements with parameterised values.
 *
 * @example
 * const bobbyTables = "Robert'); DROP TABLE Students;--";
 * // Query will use bound parameter making it immune from SQL injection
 * const rows = await db.all(sql`SELECT * FROM students WHERE name = ${bobbyTables}`);
 */
export const sql: SqlApi = Object.assign(
	(strings: TemplateStringsArray, ...values: unknown[]): ExecutableStatement => {
		return new ExecutableStatementImpl(strings, values);
	},
	{
		raw(sqlString: string): ExecutableStatement {
			return new ExecutableStatementImpl([sqlString], []);
		},
	},
);
