import { describe, expect, test } from "bun:test";
import type { Row } from "./query-types.ts";
import { StatementImpl } from "./StatementImpl.ts";

describe(StatementImpl.prototype.toHumanReadableSql, () => {
	test("renders statement with params", () => {
		const stmt = new StatementImpl([
			{ sql: "SELECT * FROM users WHERE id = ", param: 123 },
			{ sql: " AND name = ", param: "Alice" },
		]);

		expect(stmt.toHumanReadableSql()).toBe(
			'SELECT * FROM users WHERE id = [$1: 123] AND name = [$2: "Alice"]',
		);
	});

	test("renders statement without params", () => {
		const stmt = new StatementImpl(["SELECT * FROM users"]);

		expect(stmt.toHumanReadableSql()).toBe("SELECT * FROM users");
	});

	test("truncates long params", () => {
		const longString = "x".repeat(150);
		const stmt = new StatementImpl([{ sql: "SELECT ", param: longString }]);

		const rendered = stmt.toHumanReadableSql();

		expect(rendered).toContain("...hiding 52 more chars");
		expect(rendered.length).toBeLessThan(300);
	});

	test("handles non-JSON-serialisable values", () => {
		const circular: Row = {};
		circular.self = circular;
		const stmt = new StatementImpl([{ sql: "SELECT ", param: circular }]);

		expect(stmt.toHumanReadableSql()).toBe("SELECT [$1: [object Object]]");
	});

	test("renders null parameter", () => {
		const stmt = new StatementImpl([{ sql: "SELECT ", param: null }]);

		expect(stmt.toHumanReadableSql()).toBe("SELECT [$1: null]");
	});

	test("throws on undefined parameter", () => {
		const stmt = new StatementImpl([{ sql: "SELECT ", param: undefined }]);

		expect(() => stmt.toHumanReadableSql()).toThrow(
			"Cannot bind undefined value. Use null for NULL values.",
		);
	});
});
