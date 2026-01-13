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

	test("throws with helpful message if parameter is undefined", () => {
		expect(() => sql`SELECT * FROM users WHERE id = ${undefined}`).toThrow(
			"Cannot pass undefined for parameter 1 in sql`...`. Use null for NULL values.",
		);
	});

	test("throws with index for second undefined parameter", () => {
		expect(() => sql`SELECT * FROM users WHERE id = ${1} AND name = ${undefined}`).toThrow(
			"Cannot pass undefined for parameter 2 in sql`...`. Use null for NULL values.",
		);
	});

	test("allows null parameters", () => {
		const stmt = sql`SELECT * FROM users WHERE id = ${null}`;

		expect(stmt.sqlFragments).toEqual([{ sql: "SELECT * FROM users WHERE id = ", param: null }]);
	});
});
