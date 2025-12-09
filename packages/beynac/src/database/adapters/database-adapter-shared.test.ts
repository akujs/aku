import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { mockDispatcher } from "../../test-utils/internal-mocks.bun.ts";
import type { Database } from "../contracts/Database.js";
import { DatabaseImpl } from "../DatabaseImpl.ts";
import { QueryError } from "../database-errors.ts";
import type { SharedTestConfig } from "../database-test-utils.ts";
import { sql } from "../sql.ts";
import { d1SharedTestConfig } from "./d1/D1Database.test.ts";
import { pgLiteSharedTestConfig } from "./pglite/PGLiteDatabase.test.ts";
import { postgresSharedTestConfig } from "./postgres/PostgresDatabase.test.ts";
import {
	sqliteFileSharedTestConfig,
	sqliteMemorySharedTestConfig,
} from "./sqlite/SqliteDatabase.test.ts";

const adapterConfigs: SharedTestConfig[] = [
	sqliteMemorySharedTestConfig,
	sqliteFileSharedTestConfig,
	pgLiteSharedTestConfig,
	d1SharedTestConfig,
	postgresSharedTestConfig,
];

describe.each(adapterConfigs)("$name", ({ createDatabase, supportsTransactions }) => {
	let db: Database;

	beforeAll(async () => {
		db = new DatabaseImpl(await createDatabase(), {}, mockDispatcher());
		await db.run(sql`CREATE TABLE users (name TEXT, age INTEGER)`);
	});

	beforeEach(async () => {
		await db.run(sql`DELETE FROM users`);
	});

	describe("run()", () => {
		test("executes SELECT with no results", async () => {
			const result = await db.run(sql`SELECT * FROM users`);
			expect(result.rows).toEqual([]);
			expect(result.rowsAffected).toBe(0);
		});

		test("executes SELECT with results", async () => {
			await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);
			await db.run(sql`INSERT INTO users (name, age) VALUES ('Bob', 25)`);

			const result = await db.run(sql`SELECT name, age FROM users ORDER BY name`);
			expect(result.rows).toEqual([
				{ name: "Alice", age: 30 },
				{ name: "Bob", age: 25 },
			]);
			expect(result.rowsAffected).toBe(2);
		});

		test("interpolates parameters", async () => {
			await db.run(sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${30})`);
			await db.run(sql`INSERT INTO users (name, age) VALUES (${null}, ${null})`);
			const result = await db.run(sql`SELECT name, age FROM users ORDER BY name NULLS LAST`);
			expect(result.rows).toEqual([
				{ name: "Alice", age: 30 },
				{ name: null, age: null },
			]);
		});

		test("throws QueryError on invalid SQL", async () => {
			expect(db.run(sql`SELECT * FROM nonexistent_table`)).rejects.toBeInstanceOf(QueryError);
		});

		test("executes INSERT and returns rowsAffected", async () => {
			const result = await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);
			expect(result.rowsAffected).toBe(1);
			expect(result.rows).toEqual([]);
		});

		test("executes UPDATE and returns rowsAffected", async () => {
			await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);
			await db.run(sql`INSERT INTO users (name, age) VALUES ('Bob', 25)`);

			const result = await db.run(sql`UPDATE users SET age = age + 1`);
			expect(result.rowsAffected).toBe(2);
			expect(result.rows).toEqual([]);
		});

		test("executes DELETE and returns rowsAffected", async () => {
			await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);
			await db.run(sql`INSERT INTO users (name, age) VALUES ('Bob', 25)`);

			const result = await db.run(sql`DELETE FROM users WHERE age < 30`);
			expect(result.rowsAffected).toBe(1);
			expect(result.rows).toEqual([]);
		});

		test("executes DDL and returns zero rowsAffected", async () => {
			const result = await db.run(sql`CREATE TABLE temp_table (id INTEGER)`);
			expect(result.rowsAffected).toBe(0);
			expect(result.rows).toEqual([]);
		});
	});

	describe("batch()", () => {
		test("executes multiple statements atomically", async () => {
			const results = await db.batch([
				sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`,
				sql`INSERT INTO users (name, age) VALUES ('Bob', 25)`,
			]);

			expect(results).toHaveLength(2);
			expect(results[0].rowsAffected).toBe(1);
			expect(results[1].rowsAffected).toBe(1);

			const queryResult = await db.run(sql`SELECT name, age FROM users ORDER BY name`);
			expect(queryResult.rows).toEqual([
				{ name: "Alice", age: 30 },
				{ name: "Bob", age: 25 },
			]);
		});

		test("rolls back all statements on failure", async () => {
			expect(
				db.batch([
					sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`,
					sql`INSERT INTO nonexistent_table (x) VALUES (1)`,
				]),
			).rejects.toBeInstanceOf(QueryError);

			// First insert should have been rolled back
			const result = await db.run(sql`SELECT * FROM users`);
			expect(result.rows).toEqual([]);
		});

		test("executes empty batch", async () => {
			const results = await db.batch([]);
			expect(results).toEqual([]);
		});
	});

	if (supportsTransactions) {
		describe("transaction()", () => {
			test("commits on success", async () => {
				await db.transaction(async () => {
					await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);
					await db.run(sql`INSERT INTO users (name, age) VALUES ('Bob', 25)`);
				});

				const result = await db.run(sql`SELECT * FROM users ORDER BY name`);
				expect(result.rows).toHaveLength(2);
			});

			test("rolls back on error", async () => {
				expect(
					db.transaction(async () => {
						await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);
						throw new Error("Simulated failure");
					}),
				).rejects.toThrow("Simulated failure");

				const result = await db.run(sql`SELECT * FROM users`);
				expect(result.rows).toEqual([]);
			});

			test("returns value from callback", async () => {
				const result = await db.transaction(async () => {
					await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);
					return "success";
				});

				expect(result).toBe("success");
			});

			test("supports nested transactions with savepoints", async () => {
				await db.transaction(async () => {
					await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);

					// Nested transaction that fails
					expect(
						db.transaction(async () => {
							await db.run(sql`INSERT INTO users (name, age) VALUES ('Bob', 25)`);
							throw new Error("Nested failure");
						}),
					).rejects.toThrow("Nested failure");

					// Continue with outer transaction
					await db.run(sql`INSERT INTO users (name, age) VALUES ('Charlie', 35)`);
				});

				const result = await db.run(sql`SELECT name FROM users ORDER BY name`);
				expect(result.rows).toEqual([{ name: "Alice" }, { name: "Charlie" }]);
			});

			test("supports deeply nested transactions", async () => {
				await db.transaction(async () => {
					await db.run(sql`INSERT INTO users (name, age) VALUES ('Level0', 0)`);

					await db.transaction(async () => {
						await db.run(sql`INSERT INTO users (name, age) VALUES ('Level1', 1)`);

						await db.transaction(async () => {
							await db.run(sql`INSERT INTO users (name, age) VALUES ('Level2', 2)`);
						});
					});
				});

				const result = await db.run(sql`SELECT name FROM users ORDER BY age`);
				expect(result.rows).toEqual([{ name: "Level0" }, { name: "Level1" }, { name: "Level2" }]);
			});

			test("batch inside transaction creates nested transaction", async () => {
				await db.transaction(async () => {
					await db.run(sql`INSERT INTO users (name, age) VALUES ('Alice', 30)`);

					try {
						await db.batch([
							sql`INSERT INTO users (name, age) VALUES ('Bob', 30)`,
							sql`INSERT INTO whoopsie! (name, age) VALUES ('Bob', 25)`,
						]);
					} catch {}
				});

				const result = await db.run(sql`SELECT * FROM users ORDER BY name`);
				expect(result.rows).toHaveLength(1);
				expect(result.rows[0].name).toBe("Alice");
			});
		});
	}
});
