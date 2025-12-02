import { beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "../contracts/Database.ts";
import { QueryError } from "../database-errors.ts";
import type { SharedTestConfig } from "../database-test-utils.ts";
import { sql } from "../sql.ts";
import { sqliteSharedTestConfig } from "./sqlite/SqliteDatabase.test.ts";

const adapterConfigs: SharedTestConfig[] = [sqliteSharedTestConfig];

describe.each(adapterConfigs)("$name", ({ createDatabase }) => {
	let db: Database;

	beforeEach(async () => {
		db = await createDatabase();
		// Create test tables
		await db.execute(sql`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)`);
		await db.execute(sql`CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT)`);
	});

	describe("query()", () => {
		test("executes SELECT with no results", async () => {
			const result = await db.query(sql`SELECT * FROM users`);
			expect(result.rows).toEqual([]);
		});

		test("executes SELECT with results", async () => {
			await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`);
			await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Bob"}, ${25})`);

			const result = await db.query(sql`SELECT name, age FROM users ORDER BY name`);
			expect(result.rows).toEqual([
				{ name: "Alice", age: 30 },
				{ name: "Bob", age: 25 },
			]);
		});

		test("handles null values", async () => {
			await db.execute(sql`INSERT INTO users (name, age) VALUES (${null}, ${null})`);
			const result = await db.query(sql`SELECT name, age FROM users`);
			expect(result.rows).toEqual([{ name: null, age: null }]);
		});

		test("throws QueryError on invalid SQL", async () => {
			expect(db.query(sql`SELECT * FROM nonexistent_table`)).rejects.toBeInstanceOf(QueryError);
		});
	});

	describe("execute()", () => {
		test("executes INSERT and returns rowsAffected", async () => {
			const result = await db.execute(
				sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`,
			);
			expect(result.rowsAffected).toBe(1);
		});

		test("executes UPDATE and returns rowsAffected", async () => {
			await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`);
			await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Bob"}, ${25})`);

			const result = await db.execute(sql`UPDATE users SET age = age + 1`);
			expect(result.rowsAffected).toBe(2);
		});

		test("executes DELETE and returns rowsAffected", async () => {
			await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`);
			await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Bob"}, ${25})`);

			const result = await db.execute(sql`DELETE FROM users WHERE age < ${30}`);
			expect(result.rowsAffected).toBe(1);
		});
	});

	describe("batch()", () => {
		test("executes multiple statements atomically", async () => {
			const results = await db.batch([
				sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`,
				sql`INSERT INTO users (name, age) VALUES (${"Bob"}, ${25})`,
			]);

			expect(results).toHaveLength(2);
			expect(results[0].rowsAffected).toBe(1);
			expect(results[1].rowsAffected).toBe(1);

			const queryResult = await db.query(sql`SELECT * FROM users ORDER BY name`);
			expect(queryResult.rows).toEqual([
				{ id: 1, name: "Alice", age: 30 },
				{ id: 2, name: "Bob", age: 25 },
			]);
		});

		test("rolls back all statements on failure", async () => {
			expect(
				db.batch([
					sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`,
					sql`INSERT INTO nonexistent_table (x) VALUES (1)`,
				]),
			).rejects.toBeInstanceOf(QueryError);

			// First insert should have been rolled back
			const result = await db.query(sql`SELECT * FROM users`);
			expect(result.rows).toEqual([]);
		});

		test("executes empty batch", async () => {
			const results = await db.batch([]);
			expect(results).toEqual([]);
		});
	});

	describe("transaction()", () => {
		test("commits on success", async () => {
			await db.transaction(async () => {
				await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`);
				await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Bob"}, ${25})`);
			});

			const result = await db.query(sql`SELECT * FROM users ORDER BY name`);
			expect(result.rows).toHaveLength(2);
		});

		test("rolls back on error", async () => {
			expect(
				db.transaction(async () => {
					await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`);
					throw new Error("Simulated failure");
				}),
			).rejects.toThrow("Simulated failure");

			const result = await db.query(sql`SELECT * FROM users`);
			expect(result.rows).toEqual([]);
		});

		test("returns value from callback", async () => {
			const result = await db.transaction(async () => {
				await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`);
				return "success";
			});

			expect(result).toBe("success");
		});

		test("supports nested transactions with savepoints", async () => {
			await db.transaction(async () => {
				await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`);

				// Nested transaction that fails
				expect(
					db.transaction(async () => {
						await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Bob"}, ${25})`);
						throw new Error("Nested failure");
					}),
				).rejects.toThrow("Nested failure");

				// Continue with outer transaction
				await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Charlie"}, ${35})`);
			});

			const result = await db.query(sql`SELECT name FROM users ORDER BY name`);
			expect(result.rows).toEqual([{ name: "Alice" }, { name: "Charlie" }]);
		});

		test("supports deeply nested transactions", async () => {
			await db.transaction(async () => {
				await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Level0"}, ${0})`);

				await db.transaction(async () => {
					await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Level1"}, ${1})`);

					await db.transaction(async () => {
						await db.execute(sql`INSERT INTO users (name, age) VALUES (${"Level2"}, ${2})`);
					});
				});
			});

			const result = await db.query(sql`SELECT name FROM users ORDER BY age`);
			expect(result.rows).toEqual([{ name: "Level0" }, { name: "Level1" }, { name: "Level2" }]);
		});

		test("batch inside transaction doesn't create nested transaction", async () => {
			await db.transaction(async () => {
				await db.batch([
					sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`,
					sql`INSERT INTO users (name, age) VALUES (${"Bob"}, ${25})`,
				]);
			});

			const result = await db.query(sql`SELECT * FROM users ORDER BY name`);
			expect(result.rows).toHaveLength(2);
		});
	});
});
