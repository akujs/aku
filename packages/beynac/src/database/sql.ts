import type { ExecutableStatement } from "./ExecutableStatement.ts";
import { ExecutableStatementImpl } from "./ExecutableStatementImpl.ts";
import type { SqlFragment } from "./Statement.ts";

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
		const fragments: (string | SqlFragment)[] = [];
		for (let i = 0; i < strings.length; i++) {
			if (i < values.length) {
				fragments.push({ sql: strings[i], param: values[i] });
			} else if (strings[i]) {
				fragments.push(strings[i]);
			}
		}
		return new ExecutableStatementImpl(fragments);
	},
	{
		raw(sqlString: string): ExecutableStatement {
			return new ExecutableStatementImpl([sqlString]);
		},
	},
);
