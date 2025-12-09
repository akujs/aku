import { describe, expect, test } from "bun:test";
import { StatementImpl } from "./StatementImpl.ts";

describe(StatementImpl.prototype.renderSql, () => {
	test("renders with $N placeholders (Postgres style)", () => {
		const stmt = new StatementImpl(
			["SELECT * FROM users WHERE id = ", " AND name = ", ""],
			[123, "Alice"],
		);

		expect(stmt.renderSql((i) => `$${i + 1}`)).toBe(
			"SELECT * FROM users WHERE id = $1 AND name = $2",
		);
	});

	test("renders statement without params", () => {
		const stmt = new StatementImpl(["SELECT * FROM users"], []);

		expect(stmt.renderSql(() => "?")).toBe("SELECT * FROM users");
	});
});

describe(StatementImpl.prototype.renderForLogs, () => {
	test("renders statement with params", () => {
		const stmt = new StatementImpl(
			["SELECT * FROM users WHERE id = ", " AND name = ", ""],
			[123, "Alice"],
		);

		expect(stmt.renderForLogs()).toBe(
			'SELECT * FROM users WHERE id = [Param#1: 123] AND name = [Param#2: "Alice"]',
		);
	});

	test("renders statement without params", () => {
		const stmt = new StatementImpl(["SELECT * FROM users"], []);

		expect(stmt.renderForLogs()).toBe("SELECT * FROM users");
	});

	test("truncates long params", () => {
		const longString = "x".repeat(150);
		const stmt = new StatementImpl(["SELECT ", ""], [longString]);

		const rendered = stmt.renderForLogs();

		expect(rendered).toContain("...hiding 52 more chars");
		expect(rendered.length).toBeLessThan(300);
	});

	test("handles non-JSON-serialisable values", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const stmt = new StatementImpl(["SELECT ", ""], [circular]);

		expect(stmt.renderForLogs()).toBe("SELECT [Param#1: [object Object]]");
	});

	test("renders null and undefined", () => {
		const stmt = new StatementImpl(["SELECT ", ", ", ""], [null, undefined]);

		expect(stmt.renderForLogs()).toBe("SELECT [Param#1: null], [Param#2: undefined]");
	});
});
