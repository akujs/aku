import { describe, expect, test } from "bun:test";
import { renderStatementForLogs, renderStatementSql, sql } from "./sql.ts";

describe(sql, () => {
	test("returns fragments and params from template literal", () => {
		const stmt = sql`SELECT * FROM users WHERE id = ${123} AND name = ${"Alice"}`;
		expect(stmt).toEqual({
			fragments: ["SELECT * FROM users WHERE id = ", " AND name = ", ""],
			params: [123, "Alice"],
		});
	});
});

describe(renderStatementSql, () => {
	test("renders with $N placeholders (Postgres style)", () => {
		const stmt = sql`SELECT * FROM users WHERE id = ${123} AND name = ${"Alice"}`;
		expect(renderStatementSql(stmt, (i) => `$${i + 1}`)).toBe(
			"SELECT * FROM users WHERE id = $1 AND name = $2",
		);
	});

	test("renders statement without params", () => {
		const stmt = sql`SELECT * FROM users`;
		expect(renderStatementSql(stmt, () => "?")).toBe("SELECT * FROM users");
	});
});

describe(renderStatementForLogs, () => {
	test("renders statement with params", () => {
		const stmt = sql`SELECT * FROM users WHERE id = ${123} AND name = ${"Alice"}`;
		expect(renderStatementForLogs(stmt)).toBe(
			'SELECT * FROM users WHERE id = [Param#1: 123] AND name = [Param#2: "Alice"]',
		);
	});

	test("renders statement without params", () => {
		const stmt = sql`SELECT * FROM users`;
		expect(renderStatementForLogs(stmt)).toBe("SELECT * FROM users");
	});

	test("truncates long params", () => {
		const longString = "x".repeat(150);
		const stmt = sql`SELECT ${longString}`;
		const rendered = renderStatementForLogs(stmt);
		expect(rendered).toContain("...hiding 52 more chars");
		expect(rendered.length).toBeLessThan(300);
	});

	test("handles non-JSON-serialisable values", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const stmt = sql`SELECT ${circular}`;
		expect(renderStatementForLogs(stmt)).toBe("SELECT [Param#1: [object Object]]");
	});

	test("renders null and undefined", () => {
		const stmt = sql`SELECT ${null}, ${undefined}`;
		expect(renderStatementForLogs(stmt)).toBe("SELECT [Param#1: null], [Param#2: undefined]");
	});
});
