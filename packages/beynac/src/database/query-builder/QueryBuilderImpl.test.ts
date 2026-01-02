import { beforeAll, beforeEach, describe, expect, expectTypeOf, spyOn, test } from "bun:test";
import { sleep } from "../../helpers/async/sleep.ts";
import { abort } from "../../http/abort.ts";
import { mockDispatcher } from "../../test-utils/internal-mocks.bun.ts";
import { pgLiteSharedTestConfig } from "../adapters/pglite/pglite-test-utils.ts";
import { sqliteMemorySharedTestConfig } from "../adapters/sqlite/sqlite-test-utils.ts";
import type { Database } from "../contracts/Database.js";
import type { DatabaseAdapter } from "../DatabaseAdapter.ts";
import type { DatabaseClient } from "../DatabaseClient.ts";
import { DatabaseImpl } from "../DatabaseImpl.ts";
import type { SharedTestConfig } from "../database-test-utils.ts";
import { PostgresGrammar } from "../grammar/PostgresGrammar.ts";
import type { QueryBuilder, Row } from "../query-types.ts";
import { sql } from "../sql.ts";
import { QueryBuilderImpl } from "./QueryBuilderImpl.ts";

const grammar = new PostgresGrammar();

// Stub client for SQL generation tests (no actual execution)
const stubClient = {} as DatabaseClient;

const table = (table: string) => QueryBuilderImpl.table(table, grammar, stubClient);

describe(QueryBuilderImpl, () => {
	describe("immutability", () => {
		test(".where creates a new copy and does not change the original", () => {
			const base = table("artists").where("active = TRUE");
			const young = base.where("age < 30");
			const old = base.where("age >= 60");

			expect(base.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ( "active" = TRUE )"`,
			);
			expect(young.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ( "active" = TRUE ) AND ( "age" < 30 )"`,
			);
			expect(old.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ( "active" = TRUE ) AND ( "age" >= 60 )"`,
			);
		});

		test("branching with parameters preserves immutability", () => {
			const base = table("artists").where("status = ?", "active");
			const young = base.where("age < ?", 30);
			const old = base.where("age >= ?", 60);

			expect(base.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ( "status" = [$1: "active"] )"`,
			);
			expect(young.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ( "status" = [$1: "active"] ) AND ( "age" < [$2: 30] )"`,
			);
			expect(old.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ( "status" = [$1: "active"] ) AND ( "age" >= [$2: 60] )"`,
			);
		});
	});

	describe("positional parameters", () => {
		test("runtime error for arity mismatch with non-literal strings", () => {
			expect(() =>
				table("t").where("a = ? AND b = ?" as string, 1),
			).toThrowErrorMatchingInlineSnapshot(
				`"SQL placeholder count mismatch: found 2 '?' placeholder markers but got 1 parameter. SQL: "a = ? AND b = ?". Consider using sql\`...\` if you need to include literal "?" characters in your SQL."`,
			);
		});
	});

	describe("undefined value validation", () => {
		test("where throws with helpful message if placeholder value is undefined", () => {
			expect(() => table("t").where("id = ?", undefined)).toThrow(
				"Cannot pass undefined for parameter 1 in where('id = ?', ...). Use null for NULL values.",
			);
		});

		test("where throws with index for second undefined parameter", () => {
			expect(() => table("t").where("a = ? AND b = ?", 1, undefined)).toThrow(
				"Cannot pass undefined for parameter 2 in where('a = ? AND b = ?', ...). Use null for NULL values.",
			);
		});

		test.each(["join", "innerJoin", "leftJoin", "rightJoin", "fullJoin"] as const)(
			"%s throws with helpful message if placeholder value is undefined",
			(joinType) => {
				expect(() => table("t")[joinType]("other ON other.id = ?", undefined)).toThrow(
					`Cannot pass undefined for parameter 1 in ${joinType}('other ON other.id = ?', ...). Use null for NULL values.`,
				);
			},
		);

		test("having throws with helpful message if placeholder value is undefined", () => {
			expect(() => table("t").groupBy("status").having("COUNT(*) > ?", undefined)).toThrow(
				"Cannot pass undefined for parameter 1 in having('COUNT(*) > ?', ...). Use null for NULL values.",
			);
		});

		test("insert throws with helpful message if value is undefined", () => {
			expect(() => table("t").insert({ id: 1, name: "test", value: undefined })).toThrow(
				"Cannot pass undefined for property 'value' to insert(...). Use null for NULL values.",
			);
		});

		test("insert array throws with helpful message if any row has undefined", () => {
			expect(() =>
				table("t").insert([
					{ id: 1, name: "first", value: 100 },
					{ id: 2, name: "second", value: undefined },
				]),
			).toThrow(
				"Cannot pass undefined for property 'value' to insert(...). Use null for NULL values.",
			);
		});

		test("updateAll throws with helpful message if value is undefined", () => {
			expect(() =>
				table("t").where("id = ?", 1).updateAll({ name: "updated", value: undefined }),
			).toThrow(
				"Cannot pass undefined for property 'value' to updateAll(...). Use null for NULL values.",
			);
		});
	});

	describe("identifier quoting for object keys", () => {
		test("INSERT quotes column names with spaces, keywords, and quotes", () => {
			const query = table("t").insert({ "my column": 1, ORDER: 2, 'has"quote': 3 });
			expect(query.toHumanReadableSql()).toContain('"my column", "ORDER", "has""quote"');
		});

		test("RETURNING quotes column names with spaces and keywords", () => {
			const query = table("t").insert({ id: 1 }).returning("my column", "ORDER");
			expect(query.toHumanReadableSql()).toContain('RETURNING "my column", "ORDER"');
		});

		test("ON CONFLICT quotes conflict and update columns with spaces", () => {
			const query = table("t")
				.insert({ "my key": 1, "my column": "test" })
				.onConflict({ on: "my key", do: "update" });
			expect(query.toHumanReadableSql()).toContain('ON CONFLICT ("my key")');
			expect(query.toHumanReadableSql()).toContain('"my column" = EXCLUDED."my column"');
		});

		test("UPDATE quotes column names with spaces and keywords", () => {
			const query = table("t").where("id = 1").updateAll({ "my column": 2, ORDER: 3 });
			expect(query.toHumanReadableSql()).toContain('SET "my column" =');
			expect(query.toHumanReadableSql()).toContain('"ORDER" =');
		});

		test("updateFrom quotes column names with spaces and keywords", () => {
			const query = table("t").updateFrom([{ id: 1, "my column": "val", ORDER: "x" }]);
			expect(query.toHumanReadableSql()).toContain('"my column" = CASE');
			expect(query.toHumanReadableSql()).toContain('"ORDER" = CASE');
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

			db.table("teams").insert([
				{ id: 1, name: "team_a", order: "first" },
				{ id: 2, name: "team_b", order: "second" },
				{ id: 3, name: "team_c", order: "third" },
			]),

			db.table("members").insert([
				{ id: 1, name: "member_a1", team_id: 1, score: 10 },
				{ id: 2, name: "member_a2", team_id: 1, score: 20 },
				{ id: 3, name: "member_b1", team_id: 2, score: 30 },
				{ id: 4, name: "member_b2", team_id: 2, score: 40 },
				{ id: 5, name: "member_a3", team_id: 1, score: 50 },
				{ id: 6, name: "member_x1", team_id: null, score: 60 },
			]),

			db.table("tags").insert([
				{ id: 1, tag: "tag_x" },
				{ id: 2, tag: "tag_y" },
			]),

			db.table("awards").insert([
				{ id: 1, member_id: 1, title: "gold", year: 2020 },
				{ id: 2, member_id: 2, title: "silver", year: 2021 },
				{ id: 3, member_id: 3, title: "bronze", year: 2020 },
				{ id: 4, member_id: 5, title: "gold", year: 2022 },
			]),
		]);
	});

	// -------------------------------------------------------------------------
	// SELECT methods
	// -------------------------------------------------------------------------

	describe(QueryBuilderImpl.prototype.select, () => {
		test("selects all columns when not called", async () => {
			const result = await db.table("teams").orderBy("id");
			expect(result).toEqual([
				{ id: 1, name: "team_a", order: "first" },
				{ id: 2, name: "team_b", order: "second" },
				{ id: 3, name: "team_c", order: "third" },
			]);
		});

		test("selects specific columns", async () => {
			const result = await db.table("teams").select("name").orderBy("id");
			expect(result).toEqual([{ name: "team_a" }, { name: "team_b" }, { name: "team_c" }]);
		});

		test("selects columns with keyword names", async () => {
			const result = await db.table("teams").select("order").orderBy("id");
			expect(result).toEqual([{ order: "first" }, { order: "second" }, { order: "third" }]);
		});
	});

	describe(QueryBuilderImpl.prototype.addSelect, () => {
		test("adds columns to existing selection", async () => {
			const result = await db.table("teams").select("id").addSelect("name").orderBy("id");
			expect(result).toEqual([
				{ id: 1, name: "team_a" },
				{ id: 2, name: "team_b" },
				{ id: 3, name: "team_c" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.replaceSelect, () => {
		test("replaces all columns with new one", async () => {
			const result = await db
				.table("teams")
				.select("id", "name")
				.replaceSelect("order")
				.orderBy("id");
			expect(result).toEqual([{ order: "first" }, { order: "second" }, { order: "third" }]);
		});

		test("replaces all columns with multiple new ones", async () => {
			const result = await db
				.table("teams")
				.select("id", "name")
				.replaceSelect("id", "order")
				.orderBy("id");
			expect(result).toEqual([
				{ id: 1, order: "first" },
				{ id: 2, order: "second" },
				{ id: 3, order: "third" },
			]);
		});

		test("replaces all columns with none", async () => {
			const result = await db.table("teams").select("id", "name").replaceSelect().orderBy("id");
			expect(result).toEqual([
				{ id: 1, name: "team_a", order: "first" },
				{ id: 2, name: "team_b", order: "second" },
				{ id: 3, name: "team_c", order: "third" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.where, () => {
		test("filters rows with single condition", async () => {
			const result = await db.table("members").select("name").where("score > 30").orderBy("id");
			expect(result).toEqual([{ name: "member_b2" }, { name: "member_a3" }, { name: "member_x1" }]);
		});

		test("combines multiple conditions with AND", async () => {
			const query = db
				.table("members")
				.select("name")
				.where("score > 20")
				.where("score < 50")
				.orderBy("id");
			const result = await query;
			expect(result).toEqual([{ name: "member_b1" }, { name: "member_b2" }]);

			// clauses should be wrapped in parentheses
			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT "name" FROM "members" WHERE ( "score" > 20 ) AND ( "score" < 50 ) ORDER BY "id""`,
			);
		});

		test("quotes identifiers to prevent syntax errors when a column name is a keyword ", async () => {
			const result = await db
				.table("teams")
				.select("name")
				.where("order = 'first' OR order = 'third'")
				.orderBy("id");
			expect(result).toEqual([{ name: "team_a" }, { name: "team_c" }]);
		});
	});

	describe(QueryBuilderImpl.prototype.join, () => {
		test("joins tables", async () => {
			const result = await db
				.table("members")
				.select("members.name", "teams.name AS team_name")
				.join("teams ON teams.id = members.team_id")
				.orderBy("members.id");
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
			const result = await db
				.table("members")
				.select("members.name", "teams.name AS team_name")
				.innerJoin("teams ON teams.id = members.team_id")
				.orderBy("members.id");
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
			const result = await db
				.table("members")
				.select("members.name", "teams.name AS team_name")
				.leftJoin("teams ON teams.id = members.team_id")
				.orderBy("members.id");
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
				const result = await db
					.table("members")
					.select("members.name", "teams.name AS team_name")
					.rightJoin("teams ON teams.id = members.team_id")
					.orderBy("teams.id", "members.id");
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
				const result = await db
					.table("members")
					.select("members.name", "teams.name AS team_name")
					.fullJoin("teams ON teams.id = members.team_id")
					.orderBy("members.id NULLS LAST", "teams.id");
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
			const result = await db
				.table("teams")
				.select("teams.name AS team_name", "tags.tag")
				.crossJoin("tags")
				.orderBy("teams.id", "tags.id");
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
			const result = await db
				.table("members")
				.select("team_id", "COUNT(*) AS count")
				.where("team_id IS NOT NULL")
				.groupBy("team_id")
				.orderBy("team_id");
			expect(result).toEqual([
				{ team_id: 1, count: 3 },
				{ team_id: 2, count: 2 },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.having, () => {
		test("filters groups", async () => {
			const result = await db
				.table("members")
				.select("team_id", "COUNT(*) AS count")
				.groupBy("team_id")
				.having("COUNT(*) > 2")
				.orderBy("team_id");
			expect(result).toEqual([{ team_id: 1, count: 3 }]);
		});

		test("combines multiple HAVING conditions with AND", async () => {
			const query = db
				.table("members")
				.select("team_id", "COUNT(*) AS count")
				.groupBy("team_id")
				.having("COUNT(*) > 2")
				.having("SUM(score) > 0")
				.orderBy("team_id");
			const result = await query;
			expect(result).toEqual([{ team_id: 1, count: 3 }]);
			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT "team_id", COUNT(*) AS "count" FROM "members" GROUP BY "team_id" HAVING ( COUNT(*) > 2 ) AND ( SUM("score") > 0 ) ORDER BY "team_id""`,
			);
		});
	});

	describe(QueryBuilderImpl.prototype.orderBy, () => {
		test("orders ascending by default", async () => {
			const result = await db.table("members").select("name", "score").orderBy("score");
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
			const result = await db.table("members").select("name", "score").orderBy("score DESC");
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
			const result = await db
				.table("members")
				.select("name", "team_id", "score")
				.where("team_id IS NOT NULL")
				.orderBy("team_id")
				.addOrderBy("score DESC");
			expect(result).toEqual([
				{ name: "member_a3", team_id: 1, score: 50 },
				{ name: "member_a2", team_id: 1, score: 20 },
				{ name: "member_a1", team_id: 1, score: 10 },
				{ name: "member_b2", team_id: 2, score: 40 },
				{ name: "member_b1", team_id: 2, score: 30 },
			]);
		});

		test("accepts multiple columns in single call", async () => {
			const result = await db
				.table("members")
				.select("name", "team_id", "score")
				.where("team_id IS NOT NULL")
				.orderBy("team_id", "score DESC");
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
			const result = await db
				.table("teams")
				.select("name")
				.orderBy("name")
				.replaceOrderBy("id DESC");
			expect(result).toEqual([{ name: "team_c" }, { name: "team_b" }, { name: "team_a" }]);
		});
	});

	describe(QueryBuilderImpl.prototype.limit, () => {
		test("limits result count", async () => {
			const result = await db.table("members").select("id", "name").orderBy("id").limit(3);
			expect(result).toEqual([
				{ id: 1, name: "member_a1" },
				{ id: 2, name: "member_a2" },
				{ id: 3, name: "member_b1" },
			]);
		});

		test("replaces previous limit", async () => {
			const result = await db.table("members").select("id", "name").orderBy("id").limit(5).limit(2);
			expect(result).toEqual([
				{ id: 1, name: "member_a1" },
				{ id: 2, name: "member_a2" },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.offset, () => {
		test("skips rows (with limit)", async () => {
			const result = await db.table("members").select("id", "name").orderBy("id").offset(4);
			expect(result).toEqual([
				{ id: 5, name: "member_a3" },
				{ id: 6, name: "member_x1" },
			]);
		});

		test("works with limit", async () => {
			const result = await db
				.table("members")
				.select("id", "name")
				.orderBy("id")
				.limit(1)
				.offset(2);
			expect(result).toEqual([{ id: 3, name: "member_b1" }]);
		});
	});

	describe(QueryBuilderImpl.prototype.distinct, () => {
		test("removes duplicates", async () => {
			const result = await db
				.table("members")
				.select("team_id")
				.distinct()
				.orderBy("team_id NULLS FIRST");
			expect(result).toEqual([{ team_id: null }, { team_id: 1 }, { team_id: 2 }]);
		});
	});

	describe(QueryBuilderImpl.prototype.withRowLock, () => {
		test("locks rows for update by default", async () => {
			await db.transaction(async () => {
				const query = db.table("teams").select("name").withRowLock();
				expect(await query).toHaveLength(3);

				if (dialect === "postgresql") {
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
						`"SELECT "name" FROM "teams" FOR UPDATE"`,
					);
				}
				if (dialect === "sqlite") {
					// SQLite ignores row locks
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(`"SELECT "name" FROM "teams""`);
				}
			});
		});

		test("locks rows for share with mode option", async () => {
			await db.transaction(async () => {
				const query = db.table("teams").select("name").withRowLock({ mode: "share" });
				expect(await query).toHaveLength(3);

				if (dialect === "postgresql") {
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
						`"SELECT "name" FROM "teams" FOR SHARE"`,
					);
				}
			});
		});

		test("with onLocked: fail option", async () => {
			await db.transaction(async () => {
				const query = db.table("teams").select("name").withRowLock({ onLocked: "fail" });
				expect(await query).toHaveLength(3);

				if (dialect === "postgresql") {
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
						`"SELECT "name" FROM "teams" FOR UPDATE NOWAIT"`,
					);
				}
			});
		});

		test("with onLocked: skip option", async () => {
			await db.transaction(async () => {
				const query = db.table("teams").select("name").withRowLock({ onLocked: "skip" });
				expect(await query).toHaveLength(3);

				if (dialect === "postgresql") {
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
						`"SELECT "name" FROM "teams" FOR UPDATE SKIP LOCKED"`,
					);
				}
			});
		});

		test("combines mode and onLocked options", async () => {
			await db.transaction(async () => {
				const query = db.table("teams").select("name").withRowLock({
					mode: "share",
					onLocked: "skip",
				});
				expect(await query).toHaveLength(3);

				if (dialect === "postgresql") {
					expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
						`"SELECT "name" FROM "teams" FOR SHARE SKIP LOCKED"`,
					);
				}
			});
		});
	});

	if (dialect === "sqlite") {
		describe("SQLite locking behaviour", () => {
			test("withRowLock is silently ignored", async () => {
				const result = await db.table("teams").select("name").withRowLock();
				expect(result.length).toBe(3);
			});
		});
	}

	describe("positional parameters", () => {
		test("multiple parameters in one clause", async () => {
			const result = await db
				.table("members")
				.select("name")
				.where("score > ? AND team_id = ?", 20, 1)
				.orderBy("id");
			expect(result).toEqual([{ name: "member_a3" }]);
		});

		test("parameters across multiple clauses", async () => {
			const result = await db
				.table("members")
				.select("team_id", "COUNT(*) AS count")
				.where("score >= ? AND score <= ?", 10, 50)
				.where("team_id IS NOT NULL")
				.groupBy("team_id")
				.having("COUNT(*) >= ?", 2)
				.orderBy("team_id");
			// Team 1: scores 10, 20, 50 all in range → 3 members
			// Team 2: scores 30, 40 both in range → 2 members
			expect(result).toEqual([
				{ team_id: 1, count: 3 },
				{ team_id: 2, count: 2 },
			]);
		});

		test("parameters in join clauses", async () => {
			const result = await db
				.table("teams")
				.select("teams.name", "members.name AS member_name")
				.join("members ON members.team_id = teams.id AND members.score > ?", 30)
				.orderBy("teams.id", "members.id");
			expect(result).toEqual([
				{ name: "team_a", member_name: "member_a3" },
				{ name: "team_b", member_name: "member_b2" },
			]);
		});

		test("join accepts Statement from sql tag", async () => {
			const result = await db
				.table("teams")
				.select("teams.name", "members.name AS member_name")
				.join(sql`members ON members.team_id = teams.id AND members.score > ${30}`)
				.orderBy("teams.id", "members.id");
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
					const result = await db
						.table("members")
						.select("name")
						.where(idInExpr, [1, 2, 3])
						.orderBy("id");
					expect(result).toEqual([
						{ name: "member_a1" },
						{ name: "member_a2" },
						{ name: "member_b1" },
					]);
				});

				test("single-element array", async () => {
					const result = await db.table("members").select("name").where(idInExpr, [1]);
					expect(result).toEqual([{ name: "member_a1" }]);
				});

				test("empty array returns no rows", async () => {
					// Query on team_id which has NULL values (member_x1) to verify that
					// IN (NULL) correctly returns no rows - nothing equals NULL, not even NULL
					const result = await db.table("members").where(idInExpr, []);
					expect(result).toEqual([]);
				});
			},
		);
	});

	describe("subqueries", () => {
		test("subquery in WHERE clause", async () => {
			const subquery = db.table("members").select("team_id").where("score > ?", 40);
			const query = db.table("teams").select("id", "name").where("id IN ?", subquery).orderBy("id");
			expect(await query).toEqual([{ id: 1, name: "team_a" }]);
			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
				`"SELECT "id", "name" FROM "teams" WHERE ( "id" IN ( SELECT "team_id" FROM "members" WHERE ( "score" > [$1: 40] ) ) ) ORDER BY "id""`,
			);
		});

		test("subquery params merged with outer query params", async () => {
			const subquery = db.table("members").select("team_id").where("score > ?", 40);
			const result = await db
				.table("teams")
				.select("name")
				.where("id > ?", 0)
				.where("id IN ?", subquery)
				.where("id < ?", 10)
				.orderBy("id");
			expect(result).toEqual([{ name: "team_a" }]);
		});

		test("nested subqueries", async () => {
			// Find teams that have members who won gold awards
			const innerSub = db.table("awards").select("member_id").where("title = ?", "gold");
			const middleSub = db.table("members").select("team_id").where("id IN ?", innerSub);
			const result = await db.table("teams").where("id IN ?", middleSub).orderBy("id");
			expect(result).toEqual([{ id: 1, name: "team_a", order: "first" }]);
		});

		test("subquery in join clause", async () => {
			const subquery = db
				.table("members")
				.select("team_id", "COUNT(*) AS member_count")
				.where("team_id IS NOT NULL")
				.groupBy("team_id");
			const result = await db
				.table("teams t")
				.select("t.name", "counts.member_count")
				.join("? AS counts ON counts.team_id = t.id", subquery)
				.orderBy("t.id");
			expect(result).toEqual([
				{ name: "team_a", member_count: 3 },
				{ name: "team_b", member_count: 2 },
			]);
		});
	});
});

describe.each(adapterConfigs)("mutations: $name", ({ dialect, createDatabase }) => {
	let adapter: DatabaseAdapter;
	let db: Database;
	let table: QueryBuilder;

	const recreateTestMutationsTable = async () => {
		await db.batch([
			sql`DROP TABLE IF EXISTS test_mutations`,
			dialect === "sqlite"
				? sql`CREATE TABLE test_mutations (id INTEGER PRIMARY KEY, name TEXT DEFAULT 'default_name', value INTEGER DEFAULT 42)`
				: sql`CREATE TABLE test_mutations (id SERIAL PRIMARY KEY, name TEXT DEFAULT 'default_name', value INTEGER DEFAULT 42)`,
		]);
	};

	beforeAll(async () => {
		adapter = await createDatabase();
		db = new DatabaseImpl(adapter, mockDispatcher());
		table = db.table("test_mutations");
		await recreateTestMutationsTable();
	});

	beforeEach(async () => {
		await table.deleteAll();
	});

	describe(QueryBuilderImpl.prototype.insert, () => {
		test("inserts a single row", async () => {
			const result = await table.insert({ id: 1, name: "alice", value: 100 });
			expect(result.rowsAffected).toBe(1);

			const row = await table.byIdOrFail(1);
			expect(row).toEqual({ id: 1, name: "alice", value: 100 });
		});

		test("inserts multiple rows", async () => {
			const result = await table.insert([
				{ id: 1, name: "bob", value: 200 },
				{ id: 2, name: "charlie", value: 300 },
			]);
			expect(result.rowsAffected).toBe(2);

			const rows = await table.where("id IN ?", [1, 2]).orderBy("id").all();
			expect(rows).toEqual([
				{ id: 1, name: "bob", value: 200 },
				{ id: 2, name: "charlie", value: 300 },
			]);
		});

		test("empty object {} inserts row with default values", async () => {
			const result = await table.insert({});
			expect(result.rowsAffected).toBe(1);

			const rows = await table.all();
			expect(rows.length).toBe(1);
			expect(rows[0].name).toBe("default_name");
			expect(rows[0].value).toBe(42);
		});

		test("multiple empty objects [{}, {}, {}] inserts multiple rows with defaults", async () => {
			const result = await table.insert([{}, {}, {}]);
			expect(result.rowsAffected).toBe(3);

			const rows = await table.all();
			expect(rows.length).toBe(3);
			expect(rows.every((r) => r.name === "default_name" && r.value === 42)).toBe(true);
		});

		test("empty array [] returns early without hitting database when awaited", async () => {
			spyOn(db, "run");
			const result = await table.insert([]);
			expect(result.rowsAffected).toBe(0);
			const returned = await table.insert([]).returning("id");
			expect(returned).toEqual([]);
			const ids = await table.insert([]).returningId();
			expect(ids).toEqual([]);

			expect(db.run).not.toHaveBeenCalled();
		});

		test("inserts from subquery", async () => {
			await recreateTestMutationsTable();
			await table.insert([
				{ name: "bob", value: 200 },
				{ name: "charlie", value: 300 },
			]);

			await table.insert(table.select("name", "value + 50 AS value"), {
				columns: ["name", "value"],
			});

			const rows = await table.orderBy("id");
			expect(rows).toEqual([
				{ id: 1, name: "bob", value: 200 },
				{ id: 2, name: "charlie", value: 300 },
				{ id: 3, name: "bob", value: 250 },
				{ id: 4, name: "charlie", value: 350 },
			]);
		});

		test("inserts from subquery with all columns", async () => {
			await table.insert([
				{ id: 1, name: "bob", value: 200 },
				{ id: 2, name: "charlie", value: 300 },
			]);

			await table.insert(table.select("id + 100", "name", "value + 50"));

			const rows = await table.orderBy("id").all();
			expect(rows).toEqual([
				{ id: 1, name: "bob", value: 200 },
				{ id: 2, name: "charlie", value: 300 },
				{ id: 101, name: "bob", value: 250 },
				{ id: 102, name: "charlie", value: 350 },
			]);
		});

		test("inserts do not use RETURNING unless returning() is called", () => {
			const insertWithoutReturning = table.insert({ name: "test" });
			expect(insertWithoutReturning.toHumanReadableSql()).not.toContain("RETURNING");

			const insertWithReturning = db
				.table("test_mutations")
				.insert({ name: "test" })
				.returning("id");
			expect(insertWithReturning.toHumanReadableSql()).toContain("RETURNING");
		});

		test("returning() with no args returns all columns (single insert)", async () => {
			const result = await db
				.table("test_mutations")
				.insert({ id: 1, name: "return_all", value: 999 })
				.returning();

			expectTypeOf(result).toEqualTypeOf<Row>();

			expect(result).toEqual({ id: 1, name: "return_all", value: 999 });
		});

		test("returning() with args returns specified columns (single insert)", async () => {
			const result = await db
				.table("test_mutations")
				.insert({ id: 1, name: "return_test", value: 555 })
				.returning("id", "name");

			expectTypeOf(result).toEqualTypeOf<Row>();

			expect(result).toEqual({ id: 1, name: "return_test" });
		});

		test("returning() with no args returns all columns (array insert)", async () => {
			const result = await db
				.table("test_mutations")
				.insert([
					{ id: 1, name: "multi_1", value: 1 },
					{ id: 2, name: "multi_2", value: 2 },
				])
				.returning("id", "value");

			expectTypeOf(result).toEqualTypeOf<Row[]>();

			expect(result).toEqual([
				{ id: 1, value: 1 },
				{ id: 2, value: 2 },
			]);
		});

		test("returning() with args returns specified columns (array insert)", async () => {
			const result = await db
				.table("test_mutations")
				.insert([
					{ id: 1, name: "multi_1", value: 1 },
					{ id: 2, name: "multi_2", value: 2 },
				])
				.returning("id", "value");

			expectTypeOf(result).toEqualTypeOf<Row[]>();

			expect(result).toEqual([
				{ id: 1, value: 1 },
				{ id: 2, value: 2 },
			]);
		});

		test("returningId() returns array of IDs (array insert)", async () => {
			const ids = await db
				.table("test_mutations")
				.insert([
					{ id: 1, name: "id_test_1", value: 1 },
					{ id: 2, name: "id_test_2", value: 2 },
				])
				.returningId();

			expectTypeOf(ids).toEqualTypeOf<unknown[]>();

			expect(ids).toEqual([1, 2]);
		});

		test("returningId() returns single ID (single insert)", async () => {
			const id = await db
				.table("test_mutations")
				.insert({ id: 1, name: "single_id", value: 777 })
				.returningId();

			expectTypeOf(id).toEqualTypeOf<unknown>();

			expect(id).toBe(1);
		});

		test("returningId() can return id of empty object", async () => {
			await recreateTestMutationsTable(); // Reset auto-increment
			expect(await table.insert({}).returningId()).toEqual(1);
			expect(await table.insert([{}, {}]).returningId()).toEqual([2, 3]);
		});

		test("insert with columns option selects subset of properties", async () => {
			await table.insert({ id: 1, name: "subset", value: 500 }, { columns: ["id", "name"] });
			const row = await table.byIdOrFail(1);
			expect(row).toEqual({ id: 1, name: "subset", value: 42 }); // value gets default
		});

		test("insert single row with sql expression value", async () => {
			await table.insert({ id: 1, name: sql`'computed_' || 'name'`, value: 100 });
			const row = await table.byIdOrFail(1);
			expect(row).toEqual({ id: 1, name: "computed_name", value: 100 });
		});

		test("insert array with subquery value", async () => {
			await db.run(sql`CREATE TABLE expr_source (id INTEGER PRIMARY KEY, src_value INTEGER)`);
			await db.table("expr_source").insert([
				{ id: 1, src_value: 111 },
				{ id: 2, src_value: 222 },
			]);

			await table.insert([
				{
					id: 1,
					name: "sub1",
					value: db.table("expr_source").select("src_value").whereId(1),
				},
				{
					id: 2,
					name: "sub2",
					value: db.table("expr_source").select("src_value").whereId(2),
				},
			]);

			const rows = await table.where("id IN ?", [1, 2]).orderBy("id").all();
			expect(rows).toEqual([
				{ id: 1, name: "sub1", value: 111 },
				{ id: 2, name: "sub2", value: 222 },
			]);
		});
	});

	describe(QueryBuilderImpl.prototype.onConflict, () => {
		test("ignore conflict", async () => {
			await table.insert({ id: 1, name: "existing", value: 100 });

			await table
				.insert({ id: 1, name: "new name", value: 200 })
				.onConflict({ on: "id", do: "ignore" });

			const result = await table.byIdOrFail(1);
			expect(result).toEqual({ id: 1, name: "existing", value: 100 }); // unchanged
		});

		test("ignore conflict with no conflict columns", async () => {
			expect(() =>
				table.insert({ id: 1, name: "new name", value: 200 }).onConflict({ on: [], do: "ignore" }),
			).toThrowErrorMatchingInlineSnapshot(
				`"At least one 'on' is required to onConflict({on: ...})"`,
			);
		});

		test("update on conflict - all columns", async () => {
			await table.insert({ id: 2, name: "existing", value: 100 });

			await table
				.insert({ id: 2, name: "updated", value: 200 })
				.onConflict({ on: "id", do: "update" });

			const result = await table.byIdOrFail(2);
			expect(result).toEqual({ id: 2, name: "updated", value: 200 });
		});

		test("update on conflict - specific columns", async () => {
			await table.insert({ id: 3, name: "existing", value: 100 });

			await table
				.insert({ id: 3, name: "updated", value: 200 })
				.onConflict({ on: "id", do: "update", updateColumns: ["name"] });

			const result = await table.byIdOrFail(3);
			expect(result).toEqual({ id: 3, name: "updated", value: 100 }); // value unchanged
		});

		test("multiple conflict columns", async () => {
			await db.run(sql`CREATE TABLE conflict_test (
				a INTEGER,
				b INTEGER,
				c TEXT,
				PRIMARY KEY (a, b)
			)`);
			const conflictTable = db.table("conflict_test");

			await conflictTable.insert({ a: 1, b: 1, c: "original" });

			await conflictTable
				.insert({ a: 1, b: 1, c: "updated" })
				.onConflict({ on: ["a", "b"], do: "update" });

			const result = await conflictTable.where("a = ? AND b = ?", 1, 1);
			expect(result).toEqual([{ a: 1, b: 1, c: "updated" }]);
		});

		test("generates correct SQL for ignore", () => {
			const query = table.insert({ id: 1, name: "test" }).onConflict({ on: "id", do: "ignore" });

			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
				`"INSERT INTO "test_mutations" ( "id", "name" ) VALUES ( [$1: 1], [$2: "test"] ) ON CONFLICT ("id") DO NOTHING"`,
			);
		});

		test("generates correct SQL for update", () => {
			const query = table
				.insert({ id: 1, name: "test", value: 100 })
				.onConflict({ on: "id", do: "update" });

			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
				`"INSERT INTO "test_mutations" ( "id", "name", "value" ) VALUES ( [$1: 1], [$2: "test"], [$3: 100] ) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "value" = EXCLUDED."value""`,
			);
		});

		test("generates correct SQL for update with specific columns", () => {
			const query = table
				.insert({ id: 1, name: "test", value: 100 })
				.onConflict({ on: "id", do: "update", updateColumns: ["name"] });

			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
				`"INSERT INTO "test_mutations" ( "id", "name", "value" ) VALUES ( [$1: 1], [$2: "test"], [$3: 100] ) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name""`,
			);
		});

		test("works with returning", async () => {
			await table.insert({ id: 4, name: "existing", value: 100 });

			const result = await table
				.insert({ id: 4, name: "updated", value: 200 })
				.onConflict({ on: "id", do: "update" })
				.returning("id", "name");

			expect(result).toEqual({ id: 4, name: "updated" });
		});

		test("update with all columns as conflict columns uses no-op", async () => {
			// The default behaviour is to update all columns that are not
			// conflict columns, but if all columns are conflict columns, we
			// need to pick one to update in order to generate a valid SQL
			await table.insert({ id: 1 });

			const query = table.insert({ id: 1 }).onConflict({ on: "id", do: "update" }).returning("id");
			const result = await query;

			expect(result).toEqual({ id: 1 });

			expect(query.toHumanReadableSql()).toMatchInlineSnapshot(
				`"INSERT INTO "test_mutations" ( "id" ) VALUES ( [$1: 1] ) ON CONFLICT ("id") DO UPDATE SET "id" = EXCLUDED."id" RETURNING "id""`,
			);
		});

		test("throws for INSERT...SELECT without explicit columns", () => {
			const subquery = db.table("other").select("id", "name");

			expect(() => {
				table.insert(subquery).onConflict({ on: "id", do: "update" }).toHumanReadableSql();
			}).toThrow(
				"Using insert(subquery).onConflict({do: 'update'}) requires you to specify the columns",
			);
		});

		test("INSERT...SELECT without explicit columns throws explanatory error", async () => {
			expect(
				table
					.insert(db.table("test_mutations").select("id", "name"))
					.onConflict({ on: "id", do: "update" })
					.then(),
			).rejects.toMatchInlineSnapshot(
				`[DatabaseError: Using insert(subquery).onConflict({do: 'update'}) requires you to specify the columns. Either set options.columns in insert() or options.updateColumns in onConflict().]`,
			);
		});

		test("INSERT...SELECT with explicit columns works", async () => {
			await db.run(sql`CREATE TABLE source_table (id INTEGER PRIMARY KEY, name TEXT)`);
			await db.table("source_table").insert({ id: 100, name: "from_source" });

			// First insert to create conflict
			await table.insert({ id: 100, name: "existing", value: 42 });

			await table
				.insert(db.table("source_table").select("id", "name"), {
					columns: ["id", "name"],
				})
				.onConflict({ on: "id", do: "update" });

			const result = await table.byIdOrFail(100);
			expect(result).toEqual({ id: 100, name: "from_source", value: 42 });
		});
	});

	describe(QueryBuilderImpl.prototype.updateAll, () => {
		test("updates rows matching condition", async () => {
			// First insert some test data
			await table.insert({ id: 1, name: "update_test", value: 50 });

			const result = await table.whereId(1).updateAll({ value: 999 });
			expect(result.rowsAffected).toBe(1);

			const row = await table.byIdOrFail(1);
			expect(row).toEqual({ id: 1, name: "update_test", value: 999 });
		});

		test("updates all rows without where", async () => {
			// Insert test data in separate table to avoid affecting other tests
			await db.run(sql`CREATE TABLE test_update_all (id INTEGER PRIMARY KEY, flag INTEGER)`);
			await db.table("test_update_all").insert([
				{ id: 1, flag: 0 },
				{ id: 2, flag: 0 },
				{ id: 3, flag: 0 },
			]);

			const result = await db.table("test_update_all").updateAll({ flag: 1 });
			expect(result.rowsAffected).toBe(3);

			const rows = await db.table("test_update_all").orderBy("id").all();
			expect(rows.every((r) => r.flag === 1)).toBe(true);
		});

		test("updates with sql expression value", async () => {
			await table.insert({ id: 1, name: "expr_update", value: 100 });

			await table.whereId(1).updateAll({ name: sql`'prefix_' || name` });

			const row = await table.byIdOrFail(1);
			expect(row).toEqual({ id: 1, name: "prefix_expr_update", value: 100 });
		});

		test("updates with subquery value", async () => {
			await db.run(sql`CREATE TABLE update_source (id INTEGER PRIMARY KEY, src_value INTEGER)`);
			await db.table("update_source").insert({ id: 1, src_value: 999 });
			await table.insert({ id: 1, name: "sub_update", value: 0 });

			await table.whereId(1).updateAll({
				value: db.table("update_source").select("src_value").whereId(1),
			});

			const row = await table.byIdOrFail(1);
			expect(row).toEqual({ id: 1, name: "sub_update", value: 999 });
		});

		test("updates do not use RETURNING unless returning() is called", () => {
			const updateWithoutReturning = table.whereId(1).updateAll({ name: "test" });
			expect(updateWithoutReturning.toHumanReadableSql()).not.toContain("RETURNING");

			const updateWithReturning = table.whereId(1).updateAll({ name: "test" }).returning("id");
			expect(updateWithReturning.toHumanReadableSql()).toContain("RETURNING");
		});

		test("returning() with no args returns all columns", async () => {
			await table.insert({ id: 1, name: "return_test", value: 100 });

			const result = await table.whereId(1).updateAll({ name: "updated" }).returning();

			expectTypeOf(result).toEqualTypeOf<Row[]>();
			expect(result).toEqual([{ id: 1, name: "updated", value: 100 }]);
		});

		test("returning() with args returns specified columns", async () => {
			await table.insert({ id: 1, name: "return_test", value: 100 });

			const result = await table.whereId(1).updateAll({ name: "updated" }).returning("id", "name");

			expect(result).toEqual([{ id: 1, name: "updated" }]);
		});

		test("returningId() returns array of IDs", async () => {
			await table.insert([
				{ id: 1, name: "a", value: 1 },
				{ id: 2, name: "b", value: 2 },
			]);

			const ids = await table.where("id IN ?", [1, 2]).updateAll({ value: 99 }).returningId();

			expectTypeOf(ids).toEqualTypeOf<unknown[]>();
			expect(ids).toEqual([1, 2]);
		});

		test("update returning empty result when no rows match", async () => {
			const result = await table.whereId(999).updateAll({ name: "x" }).returning();
			expect(result).toEqual([]);
		});
	});

	describe(QueryBuilderImpl.prototype.deleteAll, () => {
		test("deletes rows matching condition", async () => {
			// Insert test data
			await table.insert({ id: 1, name: "delete_me", value: 0 });

			const result = await table.whereId(1).deleteAll();
			expect(result.rowsAffected).toBe(1);

			const rows = await table.whereId(1).all();
			expect(rows).toEqual([]);
		});

		test("deletes all rows without where", async () => {
			// Create separate table to avoid affecting other tests
			await db.run(sql`CREATE TABLE test_delete_all (id INTEGER PRIMARY KEY)`);
			await db.table("test_delete_all").insert([{ id: 1 }, { id: 2 }, { id: 3 }]);

			const result = await db.table("test_delete_all").deleteAll();
			expect(result.rowsAffected).toBe(3);

			const rows = await db.table("test_delete_all").all();
			expect(rows).toEqual([]);
		});

		test("deletes do not use RETURNING unless returning() is called", () => {
			const deleteWithoutReturning = table.whereId(1).deleteAll();
			expect(deleteWithoutReturning.toHumanReadableSql()).not.toContain("RETURNING");

			const deleteWithReturning = table.whereId(1).deleteAll().returning("id");
			expect(deleteWithReturning.toHumanReadableSql()).toContain("RETURNING");
		});

		test("returning() with no args returns all columns of deleted rows", async () => {
			await table.insert({ id: 1, name: "to_delete", value: 100 });

			const result = await table.whereId(1).deleteAll().returning();

			expectTypeOf(result).toEqualTypeOf<Row[]>();
			expect(result).toEqual([{ id: 1, name: "to_delete", value: 100 }]);
		});

		test("returning() with args returns specified columns", async () => {
			await table.insert({ id: 1, name: "to_delete", value: 100 });

			const result = await table.whereId(1).deleteAll().returning("id", "name");

			expect(result).toEqual([{ id: 1, name: "to_delete" }]);
		});

		test("returningId() returns array of IDs", async () => {
			await table.insert([
				{ id: 1, name: "a", value: 1 },
				{ id: 2, name: "b", value: 2 },
			]);

			const ids = await table.where("id IN ?", [1, 2]).deleteAll().returningId();

			expectTypeOf(ids).toEqualTypeOf<unknown[]>();
			expect(ids).toEqual([1, 2]);
		});

		test("delete returning empty result when no rows match", async () => {
			const result = await table.whereId(999).deleteAll().returning();
			expect(result).toEqual([]);
		});
	});

	describe(QueryBuilderImpl.prototype.updateFrom, () => {
		test("updates multiple rows with different values", async () => {
			await table.insert([
				{ id: 1, name: "alice", value: 100 },
				{ id: 2, name: "bob", value: 200 },
				{ id: 3, name: "charlie", value: 300 },
			]);

			const result = await table.updateFrom([
				{ id: 1, name: "alice_updated" },
				{ id: 2, name: "bob_updated" },
			]);

			expect(result.rowsAffected).toBe(2);

			expect(await table.orderBy("id").all()).toEqual([
				{ id: 1, name: "alice_updated", value: 100 },
				{ id: 2, name: "bob_updated", value: 200 },
				{ id: 3, name: "charlie", value: 300 },
			]);
		});

		test("updates single row", async () => {
			await table.insert({ id: 1, name: "single", value: 100 });

			const result = await table.updateFrom({ id: 1, name: "single_updated" });

			expect(result.rowsAffected).toBe(1);
			expect(await table.all()).toEqual([{ id: 1, name: "single_updated", value: 100 }]);
		});

		test("uses custom 'on' column", async () => {
			await table.insert([
				{ id: 1, name: "match_by_name", value: 100 },
				{ id: 2, name: "other", value: 200 },
			]);

			await table.updateFrom([{ name: "match_by_name", value: 999 }], { on: "name" });

			expect(await table.orderBy("id").all()).toEqual([
				{ id: 1, name: "match_by_name", value: 999 },
				{ id: 2, name: "other", value: 200 },
			]);
		});

		test("uses explicit updateColumns to select subset", async () => {
			await table.insert({ id: 1, name: "subset", value: 100 });

			await table.updateFrom([{ id: 1, name: "new_name", value: 999, extra: "ignored" }], {
				updateColumns: ["id", "name"],
			});

			// value unchanged because it's not in updateColumns
			expect(await table.all()).toEqual([{ id: 1, name: "new_name", value: 100 }]);
		});

		test("combines with where to filter subset", async () => {
			await table.insert([
				{ id: 1, name: "active1", value: 1 },
				{ id: 2, name: "inactive", value: 0 },
				{ id: 3, name: "active2", value: 1 },
			]);

			await table.where("value = ?", 1).updateFrom([
				{ id: 1, name: "updated1" },
				{ id: 2, name: "updated2" },
				{ id: 3, name: "updated3" },
			]);

			expect(await table.orderBy("id").all()).toEqual([
				{ id: 1, name: "updated1", value: 1 },
				{ id: 2, name: "inactive", value: 0 }, // Not updated - value != 1
				{ id: 3, name: "updated3", value: 1 },
			]);
		});

		test("handles partial match - only existing rows updated", async () => {
			await table.insert({ id: 1, name: "exists", value: 100 });

			const result = await table.updateFrom([
				{ id: 1, name: "updated" },
				{ id: 999, name: "nonexistent" },
			]);

			expect(result.rowsAffected).toBe(1);
			expect(await table.all()).toEqual([{ id: 1, name: "updated", value: 100 }]);
		});

		test("throws for empty array", () => {
			expect(() => table.updateFrom([])).toThrow("updateFrom requires at least one row");
		});

		test("throws when 'on' column missing from rows", () => {
			expect(() => table.updateFrom([{ name: "no_id" }])).toThrow(
				"updateFrom: the 'on' column 'id' must be present in the update columns",
			);
		});

		test("throws when undefined value in rows", () => {
			expect(() => table.updateFrom([{ id: 1, name: undefined }])).toThrow(
				"Cannot pass undefined for property 'name' to updateFrom(...). Use null for NULL values.",
			);
		});

		test("updateFrom does not use RETURNING unless returning() is called", () => {
			const updateFromWithoutReturning = table.updateFrom([{ id: 1, name: "test" }]);
			expect(updateFromWithoutReturning.toHumanReadableSql()).not.toContain("RETURNING");

			const updateFromWithReturning = table.updateFrom([{ id: 1, name: "test" }]).returning("id");
			expect(updateFromWithReturning.toHumanReadableSql()).toContain("RETURNING");
		});

		test("updateFrom with returning()", async () => {
			await table.insert([
				{ id: 1, name: "alice", value: 100 },
				{ id: 2, name: "bob", value: 200 },
			]);

			const result = await table
				.updateFrom([
					{ id: 1, name: "alice_updated" },
					{ id: 2, name: "bob_updated" },
				])
				.returning("id", "name");

			expectTypeOf(result).toEqualTypeOf<Row[]>();
			expect(result).toEqual([
				{ id: 1, name: "alice_updated" },
				{ id: 2, name: "bob_updated" },
			]);
		});

		test("updateFrom with returningId()", async () => {
			await table.insert([
				{ id: 1, name: "alice", value: 100 },
				{ id: 2, name: "bob", value: 200 },
			]);

			const ids = await table.updateFrom([{ id: 1, name: "alice_updated" }]).returningId();

			expectTypeOf(ids).toEqualTypeOf<unknown[]>();
			expect(ids).toEqual([1]);
		});
	});

	describe("query builder execution methods", () => {
		test("all() returns rows directly from builder", async () => {
			await table.insert({ id: 1, name: "direct_test", value: 42 });

			const row = await table.byIdOrFail(1);
			expect(row).toEqual({ id: 1, name: "direct_test", value: 42 });
		});

		test("firstOrNull() returns null when no rows", async () => {
			const row = await table.byIdOrNull(-999);
			expect(row).toBeNull();
		});

		test("scalar() returns single value", async () => {
			await table.insert({ id: 1, name: "scalar_test", value: 44 });

			const value = await table.select("value").whereId(1).scalar();
			expect(value).toBe(44);
		});

		test("column() returns array of single column values", async () => {
			await table.insert([
				{ id: 1, name: "col1", value: 1 },
				{ id: 2, name: "col2", value: 2 },
			]);

			const values = await db
				.table("test_mutations")
				.select("value")
				.where("id IN ?", [1, 2])
				.orderBy("id")
				.column();
			expect(values).toEqual([1, 2]);
		});
	});

	describe("byId methods", () => {
		test("byIdOrFail() returns row when found", async () => {
			await table.insert({ id: 1, name: "by_id_test", value: 100 });

			const row = await table.byIdOrFail(1);
			expect(row).toEqual({ id: 1, name: "by_id_test", value: 100 });
		});

		test("byIdOrFail() throws QueryError when not found", async () => {
			expect(table.byIdOrFail(999).then()).rejects.toMatchInlineSnapshot(
				`[QueryError: Query returned no rows (query: SELECT * FROM "test_mutations" WHERE ( "id" = [$1: 999] ))]`,
			);
		});

		test("byIdOrNotFound() throws QueryError when not found", async () => {
			expect(table.byIdOrFail(999).then()).rejects.toMatchInlineSnapshot(
				`[QueryError: Query returned no rows (query: SELECT * FROM "test_mutations" WHERE ( "id" = [$1: 999] ))]`,
			);
		});

		test("byIdOrNotFound() returns row when found", async () => {
			await table.insert({ id: 1, name: "by_id_notfound", value: 100 });

			const row = await table.byIdOrNotFound(1);
			expect(row).toEqual({ id: 1, name: "by_id_notfound", value: 100 });
		});

		test("byIdOrNotFound() calls abort.notFound when not found", async () => {
			const spy = spyOn(abort, "notFound");
			try {
				await table.byIdOrNotFound(999);
			} catch {
				// Expected to throw
			}
			expect(spy).toHaveBeenCalled();
		});

		test("byIdOrNull() returns row when found", async () => {
			await table.insert({ id: 1, name: "by_id_null", value: 100 });

			const row = await table.byIdOrNull(1);
			expect(row).toEqual({ id: 1, name: "by_id_null", value: 100 });
		});

		test("byIdOrNull() returns null when not found", async () => {
			const row = await table.byIdOrNull(999);
			expect(row).toBeNull();
		});

		test("byIdOrFail() with select() returns subset of columns", async () => {
			await table.insert({ id: 1, name: "by_id_select", value: 100 });

			const row = await table.byIdOrFail(1).select("id", "name");
			expect(row).toEqual({ id: 1, name: "by_id_select" });
		});

		test("byIdOrFail() does not execute until awaited", async () => {
			const query = table.byIdOrFail(1);
			await table.insert({ id: 1, name: "by_id_deferred", value: 100 });
			const row = await query;
			expect(row.name).toBe("by_id_deferred");
		});
	});

	describe("deferred execution", () => {
		test("insert() does not execute until awaited", async () => {
			await db.transaction(async () => {
				const query = db
					.table("test_mutations")
					.insert({ id: 1, name: "deferred_insert", value: 1 });
				// Building further doesn't execute
				query.returning("id");
				query.returningId();
				await sleep(0);
				// Verify no rows inserted yet
				expect(await table.whereId(1).all()).toEqual([]);
				// Now execute
				await query;
				expect(await table.whereId(1).all()).toHaveLength(1);
			});
		});

		test("updateAll() does not execute until awaited", async () => {
			await db.transaction(async () => {
				await table.insert({ id: 1, name: "update_deferred", value: 100 });
				const query = table.whereId(1).updateAll({ value: 999 });
				await sleep(0);
				// Verify not updated yet
				expect((await table.byIdOrFail(1)).value).toBe(100);
				// Now execute
				await query;
				expect((await table.byIdOrFail(1)).value).toBe(999);
			});
		});

		test("deleteAll() does not execute until awaited", async () => {
			await db.transaction(async () => {
				await table.insert({ id: 1, name: "delete_deferred", value: 1 });
				const query = table.whereId(1).deleteAll();
				await sleep(0);
				// Verify not deleted yet
				expect(await table.whereId(1).all()).toHaveLength(1);
				// Now execute
				await query;
				expect(await table.whereId(1).all()).toEqual([]);
			});
		});
	});

	describe("bulk mutation", () => {
		test("combines queries and mutations in a batch", async () => {
			const [q1, q2, q3, q4, q5, q6] = await db.batch([
				table.insert([{ id: 1, name: "alice", value: 200 }]),
				table.select("name").orderBy("name"),
				table.insert([{ id: 2, name: "bob", value: 300 }]),
				table.select("name").orderBy("name"),
				table.whereId(1).updateAll({ name: "alan" }),
				table.select("name").orderBy("name"),
			]);
			expect(q1.rowsAffected).toBe(1);
			expect(q2.rows).toEqual([{ name: "alice" }]);
			expect(q3.rowsAffected).toBe(1);
			expect(q4.rows).toEqual([{ name: "alice" }, { name: "bob" }]);
			expect(q5.rowsAffected).toBe(1);
			expect(q6.rows).toEqual([{ name: "alan" }, { name: "bob" }]);
		});
	});

	describe("mutation reusability", () => {
		test("same insert query can be executed multiple times", async () => {
			await db.run(
				dialect === "sqlite"
					? sql`CREATE TABLE test_reuse_insert (id INTEGER PRIMARY KEY, name TEXT)`
					: sql`CREATE TABLE test_reuse_insert (id SERIAL PRIMARY KEY, name TEXT)`,
			);
			const query = db.table("test_reuse_insert").insert({ name: "repeat" });
			await query;
			await query;
			expect(await db.table("test_reuse_insert").where("name = ?", "repeat").all()).toHaveLength(2);
		});

		test("same delete query can be executed multiple times", async () => {
			await db.run(sql`CREATE TABLE test_reuse_delete (id INTEGER PRIMARY KEY)`);
			await db.table("test_reuse_delete").insert([{ id: 1 }, { id: 2 }]);
			const query = db.table("test_reuse_delete").whereId(1).deleteAll();
			const result1 = await query;
			const result2 = await query;
			expect(result1.rowsAffected).toBe(1);
			expect(result2.rowsAffected).toBe(0); // Already deleted
		});

		test("same update query can be executed multiple times", async () => {
			await db.run(sql`CREATE TABLE test_reuse_update (id INTEGER PRIMARY KEY, value INTEGER)`);
			await db.table("test_reuse_update").insert({ id: 1, value: 0 });
			const query = db.table("test_reuse_update").updateAll({ value: 42 });
			await query;
			await query;
			expect((await db.table("test_reuse_update").firstOrFail()).value).toBe(42);
		});
	});

	describe("mutation SQL inspection", () => {
		test("can inspect DELETE SQL before executing", () => {
			const query = table.where("value > ?", 100).deleteAll();
			expect(query.toHumanReadableSql()).toContain("DELETE FROM");
			expect(query.toHumanReadableSql()).toContain("value");
		});

		test("can inspect UPDATE SQL before executing", () => {
			const query = table.whereId(1).updateAll({ value: 999 });
			expect(query.toHumanReadableSql()).toContain("UPDATE");
			expect(query.toHumanReadableSql()).toContain("value");
		});
	});
});
