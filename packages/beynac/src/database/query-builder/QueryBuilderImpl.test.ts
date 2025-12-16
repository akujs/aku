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

			expect(base.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("active" = "true")"`,
			);
			expect(young.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("active" = "true") AND ("age" < 30)"`,
			);
			expect(old.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("active" = "true") AND ("age" >= 60)"`,
			);
		});

		test("branching with parameters preserves immutability", () => {
			const base = from("artists").where("status = ?", "active");
			const young = base.where("age < ?", 30);
			const old = base.where("age >= ?", 60);

			expect(base.params).toEqual(["active"]);
			expect(young.params).toEqual(["active", 30]);
			expect(old.params).toEqual(["active", 60]);
		});
	});

	describe("type constraints", () => {
		test("select() is not available after select() has been called", () => {
			from("t")
				.select("a")
				// @ts-expect-error - select() should not be callable after select()
				.select("b");
		});

		test("too few values is a type error", () => {
			expect(() => {
				// @ts-expect-error - expects 2 values, got 1
				from("t").where("a = ? AND b = ?", 1);
			}).toThrow();
		});

		test("extra values is a type error", () => {
			expect(() => {
				// @ts-expect-error - expects 1 value, got 2
				from("t").where("a = ?", 1, 2);
			}).toThrow();
		});

		test("string cast allows any number of values", () => {
			expect(() => {
				from("t").where("a = ?" as string);
				from("t").where("a = ?" as string, 1);
				from("t").where("a = ?" as string, 1, 2);
			}).toThrow();
		});
	});

	describe("positional parameters", () => {
		test("runtime error for arity mismatch with non-literal strings", () => {
			expect(() => from("t").where("a = ? AND b = ?" as string, 1)).toThrow("expected 2");
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
			sql`CREATE TABLE awards (id INTEGER PRIMARY KEY, member_id INTEGER, title TEXT, year INTEGER)`,

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

			sql`INSERT INTO awards (id, member_id, title, year) VALUES (1, 1, 'gold', 2020)`,
			sql`INSERT INTO awards (id, member_id, title, year) VALUES (2, 2, 'silver', 2021)`,
			sql`INSERT INTO awards (id, member_id, title, year) VALUES (3, 3, 'bronze', 2020)`,
			sql`INSERT INTO awards (id, member_id, title, year) VALUES (4, 5, 'gold', 2022)`,
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
			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
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
			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
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

	describe(QueryBuilderImpl.prototype.forUpdate, () => {
		test("locks rows for update", async () => {
			await db.transaction(async () => {
				const query = db.from("teams").select("name").forUpdate();
				expect(await db.all(query)).toHaveLength(3);

				if (dialect === "postgresql") {
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
						`"SELECT "name" FROM "teams" FOR UPDATE"`,
					);
				}
				if (dialect === "sqlite") {
					// SQLite ignores FOR UPDATE
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(`"SELECT "name" FROM "teams""`);
				}
			});
		});

		test("with noWait option", async () => {
			await db.transaction(async () => {
				const query = db.from("teams").select("name").forUpdate({ noWait: true });
				expect(await db.all(query)).toHaveLength(3);

				if (dialect === "postgresql") {
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
						`"SELECT "name" FROM "teams" FOR UPDATE NOWAIT"`,
					);
				}
			});
		});

		test("with skipLocked option", async () => {
			await db.transaction(async () => {
				const query = db.from("teams").select("name").forUpdate({ skipLocked: true });
				expect(await db.all(query)).toHaveLength(3);

				if (dialect === "postgresql") {
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
						`"SELECT "name" FROM "teams" FOR UPDATE SKIP LOCKED"`,
					);
				}
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
				const result = await db.all(db.from("teams").select("name").forShare({ skipLocked: true }));
				expect(result.length).toBe(3);
			});
		});
	});

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

	describe("positional parameters", () => {
		test("multiple parameters in one clause", async () => {
			const result = await db.all(
				db.from("members").select("name").where("score > ? AND team_id = ?", 20, 1).orderBy("id"),
			);
			expect(result).toEqual([{ name: "member_a3" }]);
		});

		test("parameters across multiple clauses", async () => {
			const result = await db.all(
				db
					.from("members")
					.select("team_id", "COUNT(*) AS count")
					.where("score >= ? AND score <= ?", 10, 50)
					.where("team_id IS NOT NULL")
					.groupBy("team_id")
					.having("COUNT(*) >= ?", 2)
					.orderBy("team_id"),
			);
			// Team 1: scores 10, 20, 50 all in range → 3 members
			// Team 2: scores 30, 40 both in range → 2 members
			expect(result).toEqual([
				{ team_id: 1, count: 3 },
				{ team_id: 2, count: 2 },
			]);
		});

		test("parameters in join clauses", async () => {
			const result = await db.all(
				db
					.from("teams")
					.select("teams.name", "members.name AS member_name")
					.join("members ON members.team_id = teams.id AND members.score > ?", 30)
					.orderBy("teams.id", "members.id"),
			);
			expect(result).toEqual([
				{ name: "team_a", member_name: "member_a3" },
				{ name: "team_b", member_name: "member_b2" },
			]);
		});

		test("join accepts Statement from sql tag", async () => {
			const result = await db.all(
				db
					.from("teams")
					.select("teams.name", "members.name AS member_name")
					.join(sql`members ON members.team_id = teams.id AND members.score > ${30}`)
					.orderBy("teams.id", "members.id"),
			);
			expect(result).toEqual([
				{ name: "team_a", member_name: "member_a3" },
				{ name: "team_b", member_name: "member_b2" },
			]);
		});
	});

	describe("array expansion", () => {
		describe.each(["id IN ?", "id IN (?)", "id IN ( ? )"] as const)(
			"with syntax '%s'",
			(idInExpr) => {
				test("non-empty array expands to multiple placeholders", async () => {
					const result = await db.all(
						db.from("members").select("name").where(idInExpr, [1, 2, 3]).orderBy("id"),
					);
					expect(result).toEqual([
						{ name: "member_a1" },
						{ name: "member_a2" },
						{ name: "member_b1" },
					]);
				});

				test("single-element array", async () => {
					const result = await db.all(db.from("members").select("name").where(idInExpr, [1]));
					expect(result).toEqual([{ name: "member_a1" }]);
				});

				test("empty array returns no rows", async () => {
					// Query on team_id which has NULL values (member_x1) to verify that
					// IN (NULL) correctly returns no rows - nothing equals NULL, not even NULL
					const result = await db.all(db.from("members").where(idInExpr, []));
					expect(result).toEqual([]);
				});
			},
		);
	});

	describe("subqueries", () => {
		test("subquery in WHERE clause", async () => {
			const subquery = db.from("members").select("team_id").where("score > ?", 40);
			const query = db.from("teams").select("id", "name").where("id IN ?", subquery).orderBy("id");
			expect(await db.all(query)).toEqual([{ id: 1, name: "team_a" }]);
			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT "id", "name" FROM "teams" WHERE ("id" IN (SELECT "team_id" FROM "members" WHERE ("score" > [$1: 40]))) ORDER BY "id""`,
			);
		});

		test("subquery params merged with outer query params", async () => {
			const subquery = db.from("members").select("team_id").where("score > ?", 40);
			const result = await db.all(
				db
					.from("teams")
					.select("name")
					.where("id > ?", 0)
					.where("id IN ?", subquery)
					.where("id < ?", 10)
					.orderBy("id"),
			);
			expect(result).toEqual([{ name: "team_a" }]);
		});

		test("nested subqueries", async () => {
			// Find teams that have members who won gold awards
			const innerSub = db.from("awards").select("member_id").where("title = ?", "gold");
			const middleSub = db.from("members").select("team_id").where("id IN ?", innerSub);
			const result = await db.all(db.from("teams").where("id IN ?", middleSub).orderBy("id"));
			expect(result).toEqual([{ id: 1, name: "team_a", order: "first" }]);
		});

		test("subquery in join clause", async () => {
			const subquery = db
				.from("members")
				.select("team_id", "COUNT(*) AS member_count")
				.where("team_id IS NOT NULL")
				.groupBy("team_id");
			const result = await db.all(
				db
					.from("teams t")
					.select("t.name", "counts.member_count")
					.join("? AS counts ON counts.team_id = t.id", subquery)
					.orderBy("t.id"),
			);
			expect(result).toEqual([
				{ name: "team_a", member_count: 3 },
				{ name: "team_b", member_count: 2 },
			]);
		});
	});
});
