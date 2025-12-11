import { describe, expect, test } from "bun:test";
import { sql } from "./sql.ts";

describe("sql tagged template literal", () => {
	test("returns fragments and params from template literal", () => {
		const stmt = sql`SELECT * FROM users WHERE id = ${123} AND name = ${"Alice"}`;

		expect(stmt.fragments).toEqual(["SELECT * FROM users WHERE id = ", " AND name = ", ""]);
		expect(stmt.params).toEqual([123, "Alice"]);
	});
});
