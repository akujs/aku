import { describe, expect, test } from "bun:test";
import { sql } from "./sql.ts";

describe("sql tagged template literal", () => {
	test("returns sqlFragments and params from template literal", () => {
		const stmt = sql`SELECT * FROM users WHERE id = ${123} AND name = ${"Alice"}`;

		expect(stmt.sqlFragments).toEqual([
			{ sql: "SELECT * FROM users WHERE id = ", param: 123 },
			{ sql: " AND name = ", param: "Alice" },
		]);
	});
});
