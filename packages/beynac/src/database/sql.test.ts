import { describe, expect, test } from "bun:test";
import { sql } from "./sql.ts";

describe(sql, () => {
	test("creates statement with no parameters", () => {
		const stmt = sql`SELECT * FROM users`;
		expect(stmt).toEqual({
			sql: "SELECT * FROM users",
			params: [],
		});
	});

	test("creates statement with single parameter", () => {
		const userId = 123;
		const stmt = sql`SELECT * FROM users WHERE id = ${userId}`;
		expect(stmt).toEqual({
			sql: "SELECT * FROM users WHERE id = ?",
			params: [123],
		});
	});

	test("creates statement with multiple parameters", () => {
		const name = "Alice";
		const age = 30;
		const stmt = sql`INSERT INTO users (name, age) VALUES (${name}, ${age})`;
		expect(stmt).toEqual({
			sql: "INSERT INTO users (name, age) VALUES (?, ?)",
			params: ["Alice", 30],
		});
	});

	test("handles null and undefined parameters", () => {
		const stmt = sql`INSERT INTO users (name, email) VALUES (${null}, ${undefined})`;
		expect(stmt).toEqual({
			sql: "INSERT INTO users (name, email) VALUES (?, ?)",
			params: [null, undefined],
		});
	});

	test("handles empty string parameter", () => {
		const stmt = sql`INSERT INTO users (name) VALUES (${""})`; // eslint-disable-line @typescript-eslint/no-inferrable-types
		expect(stmt).toEqual({
			sql: "INSERT INTO users (name) VALUES (?)",
			params: [""],
		});
	});

	test("handles numeric zero parameter", () => {
		const stmt = sql`UPDATE users SET balance = ${0} WHERE id = ${1}`;
		expect(stmt).toEqual({
			sql: "UPDATE users SET balance = ? WHERE id = ?",
			params: [0, 1],
		});
	});

	test("handles boolean parameters", () => {
		const stmt = sql`UPDATE users SET active = ${true} WHERE deleted = ${false}`;
		expect(stmt).toEqual({
			sql: "UPDATE users SET active = ? WHERE deleted = ?",
			params: [true, false],
		});
	});

	test("handles parameter at start of query", () => {
		const table = "users";
		// Note: This is for testing purposes - in practice, table names shouldn't be parameterized
		const stmt = sql`${table}`;
		expect(stmt).toEqual({
			sql: "?",
			params: ["users"],
		});
	});

	test("handles consecutive parameters", () => {
		const a = 1;
		const b = 2;
		const c = 3;
		const stmt = sql`VALUES (${a}, ${b}, ${c})`;
		expect(stmt).toEqual({
			sql: "VALUES (?, ?, ?)",
			params: [1, 2, 3],
		});
	});

	test("preserves whitespace in SQL", () => {
		const id = 1;
		const stmt = sql`
			SELECT *
			FROM users
			WHERE id = ${id}
		`;
		expect(stmt.sql).toContain("\n");
		expect(stmt.sql).toContain("\t");
		expect(stmt.params).toEqual([1]);
	});

	test("handles complex types as parameters", () => {
		const date = new Date("2024-01-01");
		const buffer = Buffer.from("hello");
		const stmt = sql`INSERT INTO logs (timestamp, data) VALUES (${date}, ${buffer})`;
		expect(stmt).toEqual({
			sql: "INSERT INTO logs (timestamp, data) VALUES (?, ?)",
			params: [date, buffer],
		});
	});
});
