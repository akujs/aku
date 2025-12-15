import { beforeAll, describe, expect, test } from "bun:test";
import { mockDispatcher } from "../../test-utils/internal-mocks.bun.ts";
import { pgLiteSharedTestConfig } from "../adapters/pglite/pglite-test-utils.ts";
import { sqliteMemorySharedTestConfig } from "../adapters/sqlite/sqlite-test-utils.ts";
import type { Database } from "../contracts/Database.js";
import { DatabaseImpl } from "../DatabaseImpl.ts";
import type { SharedTestConfig } from "../database-test-utils.ts";
import { PostgresGrammar } from "../grammar/PostgresGrammar.ts";
import { sql } from "../sql.ts";
import { QueryBuilderImpl } from "./QueryBuilderImpl.ts";
import { toSql } from "./query-builder-test-utils.ts";

// For structural tests that don't execute against a database, use PostgresGrammar
// since it supports all features. For database execution tests, use db.from()
// which automatically uses the correct grammar.
const grammar = new PostgresGrammar();
const from = (table: string) => QueryBuilderImpl.from(table, grammar);

// =============================================================================
// SQL Structure Tests
// These tests verify SQL generation without executing against a database.
// Used for: immutability guarantees and type constraints.
// =============================================================================

describe(QueryBuilderImpl, () => {
	describe("immutability", () => {
		test(".where creates a new copy and does not change the original", () => {
			const base = from("artists").where("active = true");
			const young = base.where("age < 30");
			const old = base.where("age >= 60");

			expect(toSql(base)).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("active" = "true")"`,
			);
			expect(toSql(young)).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("active" = "true") AND ("age" < 30)"`,
			);
			expect(toSql(old)).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("active" = "true") AND ("age" >= 60)"`,
			);
		});
	});

	describe("type constraints", () => {
		test("select() is not available after select() has been called", () => {
			from("t")
				.select("a")
				// @ts-expect-error - select() should not be callable after select()
				.select("b");
		});
	});
});

const adapterConfigs: SharedTestConfig[] = [sqliteMemorySharedTestConfig, pgLiteSharedTestConfig];

describe.each(adapterConfigs)("queries: $name", ({ dialect, createDatabase }) => {
	let db: Database;

	beforeAll(async () => {
		db = new DatabaseImpl(await createDatabase(), mockDispatcher());
		await db.batch([
			sql`CREATE TABLE teams (id INTEGER PRIMARY KEY, name TEXT, "order" TEXT)`,
			sql`CREATE TABLE members (id INTEGER PRIMARY KEY, name TEXT, team_id INTEGER, score INTEGER)`,
			sql`CREATE TABLE tags (id INTEGER PRIMARY KEY, tag TEXT)`,

			sql`INSERT INTO teams (id, name, "order") VALUES (1, 'team_a', 'first')`,
			sql`INSERT INTO teams (id, name, "order") VALUES (2, 'team_b', 'second')`,
			sql`INSERT INTO teams (id, name, "order") VALUES (3, 'team_c', 'third')`,

			sql`INSERT INTO members (id, name, team_id, score) VALUES (1, 'member_a1', 1, 10)`,
			sql`INSERT INTO members (id, name, team_id, score) VALUES (2, 'member_a2', 1, 20)`,
			sql`INSERT INTO members (id, name, team_id, score) VALUES (3, 'member_b1', 2, 30)`,
			sql`INSERT INTO members (id, name, team_id, score) VALUES (4, 'member_b2', 2, 40)`,
			sql`INSERT INTO members (id, name, team_id, score) VALUES (5, 'member_a3', 1, 50)`,
			sql`INSERT INTO members (id, name, team_id, score) VALUES (6, 'member_x1', NULL, 60)`,

			sql`INSERT INTO tags (id, tag) VALUES (1, 'tag_x')`,
			sql`INSERT INTO tags (id, tag) VALUES (2, 'tag_y')`,
		]);
	});

	// -------------------------------------------------------------------------
	// SELECT methods
	// -------------------------------------------------------------------------

	describe(QueryBuilderImpl.prototype.select, () => {
		test("selects all columns when not called", async () => {
			const result = await db.all(db.from("teams").orderBy("id"));
			expect(result).toEqual([
				{ id: 1, name: "team_a", order: "first" },
				{ id: 2, name: "team_b", order: "second" },
				{ id: 3, name: "team_c", order: "third" },
			]);
		});

		test("selects specific columns", async () => {
			const result = await db.all(db.from("teams").select("name").orderBy("id"));
			expect(result).toEqual([{ name: "team_a" }, { name: "team_b" }, { name: "team_c" }]);
		});

		test("selects columns with keyword names", async () => {
			const query = db.from("teams").select("order").orderBy("id");
			const result = await db.all(query);
			expect(result).toEqual([{ order: "first" }, { order: "second" }, { order: "third" }]);
		});
	});

	describe(QueryBuilderImpl.prototype.addSelect, () => {
		test("adds columns to existing selection", async () => {
			const result = await db.all(db.from("teams").select("id").addSelect("name").orderBy("id"));
			expect(result).toEqual([
				{ id: 1, name: "team_a" },
				{ id: 2, name: "team_b" },
				{ id: 3, name: "team_c" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.replaceSelect, () => {
		test("replaces all columns with new one", async () => {
			const result = await db.all(
				db.from("teams").select("id", "name").replaceSelect("order").orderBy("id"),
			);
			expect(result).toEqual([{ order: "first" }, { order: "second" }, { order: "third" }]);
		});

		test("replaces all columns with multiple new ones", async () => {
			const result = await db.all(
				db.from("teams").select("id", "name").replaceSelect("id", "order").orderBy("id"),
			);
			expect(result).toEqual([
				{ id: 1, order: "first" },
				{ id: 2, order: "second" },
				{ id: 3, order: "third" },
			]);
		});

		test("replaces all columns with none", async () => {
			const result = await db.all(
				db.from("teams").select("id", "name").replaceSelect().orderBy("id"),
			);
			expect(result).toEqual([
				{ id: 1, name: "team_a", order: "first" },
				{ id: 2, name: "team_b", order: "second" },
				{ id: 3, name: "team_c", order: "third" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.where, () => {
		test("filters rows with single condition", async () => {
			const result = await db.all(
				db.from("members").select("name").where("score > 30").orderBy("id"),
			);
			expect(result).toEqual([{ name: "member_b2" }, { name: "member_a3" }, { name: "member_x1" }]);
		});

		test("combines multiple conditions with AND", async () => {
			const query = db
				.from("members")
				.select("name")
				.where("score > 20")
				.where("score < 50")
				.orderBy("id");
			const result = await db.all(query);
			expect(result).toEqual([{ name: "member_b1" }, { name: "member_b2" }]);

			// clauses should be wrapped in parentheses
			expect(toSql(query)).toMatchInlineSnapshot(
				`"SELECT "name" FROM "members" WHERE ("score" > 20) AND ("score" < 50) ORDER BY "id""`,
			);
		});

		test("quotes identifiers to prevent syntax errors when a column name is a keyword ", async () => {
			const result = await db.all(
				db.from("teams").select("name").where("order = 'first' OR order = 'third'").orderBy("id"),
			);
			expect(result).toEqual([{ name: "team_a" }, { name: "team_c" }]);
		});
	});

	describe(QueryBuilderImpl.prototype.join, () => {
		test("joins tables", async () => {
			const result = await db.all(
				db
					.from("members")
					.select("members.name", "teams.name AS team_name")
					.join("teams ON teams.id = members.team_id")
					.orderBy("members.id"),
			);
			expect(result).toEqual([
				{ name: "member_a1", team_name: "team_a" },
				{ name: "member_a2", team_name: "team_a" },
				{ name: "member_b1", team_name: "team_b" },
				{ name: "member_b2", team_name: "team_b" },
				{ name: "member_a3", team_name: "team_a" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.innerJoin, () => {
		test("behaves same as join", async () => {
			const result = await db.all(
				db
					.from("members")
					.select("members.name", "teams.name AS team_name")
					.innerJoin("teams ON teams.id = members.team_id")
					.orderBy("members.id"),
			);
			expect(result).toEqual([
				{ name: "member_a1", team_name: "team_a" },
				{ name: "member_a2", team_name: "team_a" },
				{ name: "member_b1", team_name: "team_b" },
				{ name: "member_b2", team_name: "team_b" },
				{ name: "member_a3", team_name: "team_a" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.leftJoin, () => {
		test("includes unmatched left rows with NULL", async () => {
			const result = await db.all(
				db
					.from("members")
					.select("members.name", "teams.name AS team_name")
					.leftJoin("teams ON teams.id = members.team_id")
					.orderBy("members.id"),
			);
			expect(result).toEqual([
				{ name: "member_a1", team_name: "team_a" },
				{ name: "member_a2", team_name: "team_a" },
				{ name: "member_b1", team_name: "team_b" },
				{ name: "member_b2", team_name: "team_b" },
				{ name: "member_a3", team_name: "team_a" },
				{ name: "member_x1", team_name: null },
			]);
		});
	});

	if (dialect === "postgresql") {
		describe(QueryBuilderImpl.prototype.rightJoin, () => {
			test("includes unmatched right rows with NULL", async () => {
				const result = await db.all(
					db
						.from("members")
						.select("members.name", "teams.name AS team_name")
						.rightJoin("teams ON teams.id = members.team_id")
						.orderBy("teams.id", "members.id"),
				);
				expect(result).toEqual([
					{ name: "member_a1", team_name: "team_a" },
					{ name: "member_a2", team_name: "team_a" },
					{ name: "member_a3", team_name: "team_a" },
					{ name: "member_b1", team_name: "team_b" },
					{ name: "member_b2", team_name: "team_b" },
					{ name: null, team_name: "team_c" },
				]);
			});
		});

		describe(QueryBuilderImpl.prototype.fullJoin, () => {
			test("includes unmatched rows from both sides", async () => {
				const result = await db.all(
					db
						.from("members")
						.select("members.name", "teams.name AS team_name")
						.fullJoin("teams ON teams.id = members.team_id")
						.orderBy("members.id NULLS LAST", "teams.id"),
				);
				expect(result).toEqual([
					{ name: "member_a1", team_name: "team_a" },
					{ name: "member_a2", team_name: "team_a" },
					{ name: "member_b1", team_name: "team_b" },
					{ name: "member_b2", team_name: "team_b" },
					{ name: "member_a3", team_name: "team_a" },
					{ name: "member_x1", team_name: null },
					{ name: null, team_name: "team_c" },
				]);
			});
		});
	}

	describe(QueryBuilderImpl.prototype.crossJoin, () => {
		test("produces cartesian product", async () => {
			const result = await db.all(
				db
					.from("teams")
					.select("teams.name AS team_name", "tags.tag")
					.crossJoin("tags")
					.orderBy("teams.id", "tags.id"),
			);
			expect(result).toEqual([
				{ team_name: "team_a", tag: "tag_x" },
				{ team_name: "team_a", tag: "tag_y" },
				{ team_name: "team_b", tag: "tag_x" },
				{ team_name: "team_b", tag: "tag_y" },
				{ team_name: "team_c", tag: "tag_x" },
				{ team_name: "team_c", tag: "tag_y" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.groupBy, () => {
		test("groups rows", async () => {
			const result = await db.all(
				db
					.from("members")
					.select("team_id", "COUNT(*) AS count")
					.where("team_id IS NOT NULL")
					.groupBy("team_id")
					.orderBy("team_id"),
			);
			expect(result).toEqual([
				{ team_id: 1, count: 3 },
				{ team_id: 2, count: 2 },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.having, () => {
		test("filters groups", async () => {
			const result = await db.all(
				db
					.from("members")
					.select("team_id", "COUNT(*) AS count")
					.groupBy("team_id")
					.having("COUNT(*) > 2")
					.orderBy("team_id"),
			);
			expect(result).toEqual([{ team_id: 1, count: 3 }]);
		});

		test("combines multiple HAVING conditions with AND", async () => {
			const query = db
				.from("members")
				.select("team_id", "COUNT(*) AS count")
				.groupBy("team_id")
				.having("COUNT(*) > 2")
				.having("SUM(score) > 0")
				.orderBy("team_id");
			const result = await db.all(query);
			expect(result).toEqual([{ team_id: 1, count: 3 }]);
			expect(toSql(query)).toMatchInlineSnapshot(
				`"SELECT "team_id", COUNT(*) AS "count" FROM "members" GROUP BY "team_id" HAVING (COUNT(*) > 2) AND (SUM("score") > 0) ORDER BY "team_id""`,
			);
		});
	});

	describe(QueryBuilderImpl.prototype.orderBy, () => {
		test("orders ascending by default", async () => {
			const result = await db.all(db.from("members").select("name", "score").orderBy("score"));
			expect(result).toEqual([
				{ name: "member_a1", score: 10 },
				{ name: "member_a2", score: 20 },
				{ name: "member_b1", score: 30 },
				{ name: "member_b2", score: 40 },
				{ name: "member_a3", score: 50 },
				{ name: "member_x1", score: 60 },
			]);
		});

		test("orders descending with DESC", async () => {
			const result = await db.all(db.from("members").select("name", "score").orderBy("score DESC"));
			expect(result).toEqual([
				{ name: "member_x1", score: 60 },
				{ name: "member_a3", score: 50 },
				{ name: "member_b2", score: 40 },
				{ name: "member_b1", score: 30 },
				{ name: "member_a2", score: 20 },
				{ name: "member_a1", score: 10 },
			]);
		});

		test("is additive", async () => {
			const result = await db.all(
				db
					.from("members")
					.select("name", "team_id", "score")
					.where("team_id IS NOT NULL")
					.orderBy("team_id")
					.orderBy("score DESC"),
			);
			expect(result).toEqual([
				{ name: "member_a3", team_id: 1, score: 50 },
				{ name: "member_a2", team_id: 1, score: 20 },
				{ name: "member_a1", team_id: 1, score: 10 },
				{ name: "member_b2", team_id: 2, score: 40 },
				{ name: "member_b1", team_id: 2, score: 30 },
			]);
		});

		test("accepts multiple columns in single call", async () => {
			const result = await db.all(
				db
					.from("members")
					.select("name", "team_id", "score")
					.where("team_id IS NOT NULL")
					.orderBy("team_id", "score DESC"),
			);
			expect(result).toEqual([
				{ name: "member_a3", team_id: 1, score: 50 },
				{ name: "member_a2", team_id: 1, score: 20 },
				{ name: "member_a1", team_id: 1, score: 10 },
				{ name: "member_b2", team_id: 2, score: 40 },
				{ name: "member_b1", team_id: 2, score: 30 },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.replaceOrderBy, () => {
		test("replaces all ordering", async () => {
			const result = await db.all(
				db.from("teams").select("name").orderBy("name").replaceOrderBy("id DESC"),
			);
			expect(result).toEqual([{ name: "team_c" }, { name: "team_b" }, { name: "team_a" }]);
		});
	});

	describe(QueryBuilderImpl.prototype.limit, () => {
		test("limits result count", async () => {
			const result = await db.all(db.from("members").select("id", "name").orderBy("id").limit(3));
			expect(result).toEqual([
				{ id: 1, name: "member_a1" },
				{ id: 2, name: "member_a2" },
				{ id: 3, name: "member_b1" },
			]);
		});

		test("replaces previous limit", async () => {
			const result = await db.all(
				db.from("members").select("id", "name").orderBy("id").limit(5).limit(2),
			);
			expect(result).toEqual([
				{ id: 1, name: "member_a1" },
				{ id: 2, name: "member_a2" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.offset, () => {
		test("skips rows (with limit)", async () => {
			const result = await db.all(db.from("members").select("id", "name").orderBy("id").offset(4));
			expect(result).toEqual([
				{ id: 5, name: "member_a3" },
				{ id: 6, name: "member_x1" },
			]);
		});

		test("works with limit", async () => {
			const result = await db.all(
				db.from("members").select("id", "name").orderBy("id").limit(1).offset(2),
			);
			expect(result).toEqual([{ id: 3, name: "member_b1" }]);
		});
	});

	describe(QueryBuilderImpl.prototype.distinct, () => {
		test("removes duplicates", async () => {
			const result = await db.all(
				db.from("members").select("team_id").distinct().orderBy("team_id NULLS FIRST"),
			);
			expect(result).toEqual([{ team_id: null }, { team_id: 1 }, { team_id: 2 }]);
		});
	});

	if (dialect === "postgresql") {
		describe(QueryBuilderImpl.prototype.forUpdate, () => {
			test("locks rows for update", async () => {
				await db.transaction(async () => {
					const result = await db.all(db.from("teams").select("name").forUpdate());
					expect(result.length).toBe(3);
				});
			});

			test("with noWait option", async () => {
				await db.transaction(async () => {
					const result = await db.all(db.from("teams").select("name").forUpdate({ noWait: true }));
					expect(result.length).toBe(3);
				});
			});

			test("with skipLocked option", async () => {
				await db.transaction(async () => {
					const result = await db.all(
						db.from("teams").select("name").forUpdate({ skipLocked: true }),
					);
					expect(result.length).toBe(3);
				});
			});
		});

		describe(QueryBuilderImpl.prototype.forShare, () => {
			test("locks rows for share", async () => {
				await db.transaction(async () => {
					const result = await db.all(db.from("teams").select("name").forShare());
					expect(result.length).toBe(3);
				});
			});

			test("with noWait option", async () => {
				await db.transaction(async () => {
					const result = await db.all(db.from("teams").select("name").forShare({ noWait: true }));
					expect(result.length).toBe(3);
				});
			});

			test("with skipLocked option", async () => {
				await db.transaction(async () => {
					const result = await db.all(
						db.from("teams").select("name").forShare({ skipLocked: true }),
					);
					expect(result.length).toBe(3);
				});
			});
		});
	}

	if (dialect === "sqlite") {
		describe("SQLite locking behaviour", () => {
			test("forUpdate is silently ignored", async () => {
				const result = await db.all(db.from("teams").select("name").forUpdate());
				expect(result.length).toBe(3);
			});

			test("forShare is silently ignored", async () => {
				const result = await db.all(db.from("teams").select("name").forShare());
				expect(result.length).toBe(3);
			});
		});
	}
});
