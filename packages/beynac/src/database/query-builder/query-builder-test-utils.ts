import type { Statement } from "../Statement.ts";

// Render a Statement as SQL using Postgres-style $N placeholders
export function toSql(statement: Statement): string {
	return statement.renderSql((i) => `$${i + 1}`);
}
