import { ExecutableStatementImpl } from "./ExecutableStatementImpl.ts";
import type { ExecutableStatementWithoutClient, StringOrFragment } from "./query-types.ts";

interface SqlApi {
	(strings: TemplateStringsArray, ...values: unknown[]): ExecutableStatementWithoutClient;
	raw(sqlString: string): ExecutableStatementWithoutClient;
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
	(strings: TemplateStringsArray, ...values: unknown[]): ExecutableStatementWithoutClient => {
		const fragments: StringOrFragment[] = [];
		for (let i = 0; i < strings.length; i++) {
			if (i < values.length) {
				if (values[i] === undefined) {
					throw new Error(
						`Cannot pass undefined for parameter ${i + 1} in sql\`...\`. Use null for NULL values.`,
					);
				}
				fragments.push({ sql: strings[i], param: values[i] });
			} else if (strings[i]) {
				fragments.push(strings[i]);
			}
		}
		return new ExecutableStatementImpl(fragments);
	},
	{
		raw(sqlString: string): ExecutableStatementWithoutClient {
			return new ExecutableStatementImpl([sqlString]);
		},
	},
);
