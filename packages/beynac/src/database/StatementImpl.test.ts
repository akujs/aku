import { describe, expect, test } from "bun:test";
import { StatementImpl } from "./StatementImpl.ts";

describe(StatementImpl.prototype.toHumanReadableSql, () => {
	test("renders statement with params", () => {
		const stmt = new StatementImpl(
			["SELECT * FROM users WHERE id = ", " AND name = ", ""],
			[123, "Alice"],
		);

		expect(stmt.toHumanReadableSql()).toBe(
			'SELECT * FROM users WHERE id = [$1: 123] AND name = [$2: "Alice"]',
		);
	});

	test("renders statement without params", () => {
		const stmt = new StatementImpl(["SELECT * FROM users"], []);

		expect(stmt.toHumanReadableSql()).toBe("SELECT * FROM users");
	});

	test("truncates long params", () => {
		const longString = "x".repeat(150);
		const stmt = new StatementImpl(["SELECT ", ""], [longString]);

		const rendered = stmt.toHumanReadableSql();

		expect(rendered).toContain("...hiding 52 more chars");
		expect(rendered.length).toBeLessThan(300);
	});

	test("handles non-JSON-serialisable values", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const stmt = new StatementImpl(["SELECT ", ""], [circular]);

		expect(stmt.toHumanReadableSql()).toBe("SELECT [$1: [object Object]]");
	});

	test("renders null and undefined", () => {
		const stmt = new StatementImpl(["SELECT ", ", ", ""], [null, undefined]);

		expect(stmt.toHumanReadableSql()).toBe("SELECT [$1: null], [$2: undefined]");
	});
});
