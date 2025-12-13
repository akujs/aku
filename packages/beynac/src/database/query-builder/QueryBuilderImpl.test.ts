import { describe, expect, test } from "bun:test";
import { QueryBuilderImpl } from "./QueryBuilderImpl.ts";
import { toSql } from "./query-builder-test-utils.ts";

const from = QueryBuilderImpl.from;

describe(QueryBuilderImpl, () => {
	describe("basic queries", () => {
		test("simple select all", () => {
			expect(toSql(from("artists"))).toMatchInlineSnapshot(`"SELECT * FROM "artists""`);
		});

		test("select specific columns", () => {
			expect(toSql(from("artists").select("id", "name"))).toMatchInlineSnapshot(
				`"SELECT "id", "name" FROM "artists""`,
			);
		});

		test("single where", () => {
			expect(toSql(from("artists").where("age > 30"))).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("age" > 30)"`,
			);
		});
	});

	describe("branching behaviour", () => {
		test("branches are independent", () => {
			const base = from("artists").where("active = true");
			const young = base.where("age < 30");
			const old = base.where("age >= 60");

			expect(toSql(young)).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("active" = "true") AND ("age" < 30)"`,
			);
			expect(toSql(old)).toMatchInlineSnapshot(
				`"SELECT * FROM "artists" WHERE ("active" = "true") AND ("age" >= 60)"`,
			);
		});
	});

	describe("join types", () => {
		test("inner join", () => {
			expect(toSql(from("a").join("b ON b.a_id = a.id"))).toMatchInlineSnapshot(
				`"SELECT * FROM "a" JOIN "b" ON "b"."a_id" = "a"."id""`,
			);
		});

		test("explicit inner join", () => {
			expect(toSql(from("a").innerJoin("b ON b.a_id = a.id"))).toMatchInlineSnapshot(
				`"SELECT * FROM "a" INNER JOIN "b" ON "b"."a_id" = "a"."id""`,
			);
		});

		test("multiple join types", () => {
			expect(
				toSql(from("a").leftJoin("b ON b.x = a.x").rightJoin("c ON c.y = a.y")),
			).toMatchInlineSnapshot(
				`"SELECT * FROM "a" LEFT JOIN "b" ON "b"."x" = "a"."x" RIGHT JOIN "c" ON "c"."y" = "a"."y""`,
			);
		});

		test("full outer join", () => {
			expect(toSql(from("a").fullJoin("b ON b.x = a.x"))).toMatchInlineSnapshot(
				`"SELECT * FROM "a" FULL OUTER JOIN "b" ON "b"."x" = "a"."x""`,
			);
		});

		test("cross join", () => {
			expect(toSql(from("a").crossJoin("b"))).toMatchInlineSnapshot(
				`"SELECT * FROM "a" CROSS JOIN "b""`,
			);
		});
	});

	describe("WHERE combinations", () => {
		test("multiple where clauses ANDed", () => {
			expect(toSql(from("t").where("a = 1").where("b = 2"))).toMatchInlineSnapshot(
				`"SELECT * FROM "t" WHERE ("a" = 1) AND ("b" = 2)"`,
			);
		});

		test("OR conditions preserved within parentheses", () => {
			expect(
				toSql(from("t").where("a = 1 OR a = 2").where("b = 3 OR b = 4")),
			).toMatchInlineSnapshot(
				`"SELECT * FROM "t" WHERE ("a" = 1 OR "a" = 2) AND ("b" = 3 OR "b" = 4)"`,
			);
		});
	});

	describe("select type states", () => {
		test("addSelect adds columns", () => {
			expect(toSql(from("t").select("a").addSelect("b"))).toMatchInlineSnapshot(
				`"SELECT "a", "b" FROM "t""`,
			);
		});

		test("replaceSelect replaces all columns", () => {
			expect(toSql(from("t").select("a", "b").replaceSelect("c"))).toMatchInlineSnapshot(
				`"SELECT "c" FROM "t""`,
			);
		});

		test("select() is not available after select() has been called", () => {
			// @ts-expect-error - select() should not be callable after select()
			from("t").select("a").select("b");
		});
	});

	describe("identifier quoting", () => {
		test("mixed-case identifiers are quoted", () => {
			expect(
				toSql(from("artists").select("fullName", "age").where("lastName = 'Smith'")),
			).toMatchInlineSnapshot(
				`"SELECT "fullName", "age" FROM "artists" WHERE ("lastName" = 'Smith')"`,
			);
		});
	});

	describe("grouping and having", () => {
		test("group by", () => {
			expect(
				toSql(from("artists").select("country", "COUNT(*)").groupBy("country")),
			).toMatchInlineSnapshot(`"SELECT "country", COUNT(*) FROM "artists" GROUP BY "country""`);
		});

		test("having clause", () => {
			expect(
				toSql(
					from("artists").select("country", "COUNT(*)").groupBy("country").having("COUNT(*) > 5"),
				),
			).toMatchInlineSnapshot(
				`"SELECT "country", COUNT(*) FROM "artists" GROUP BY "country" HAVING (COUNT(*) > 5)"`,
			);
		});

		test("multiple having clauses ANDed", () => {
			expect(
				toSql(
					from("artists")
						.select("country", "COUNT(*)")
						.groupBy("country")
						.having("COUNT(*) > 5")
						.having("COUNT(*) < 100"),
				),
			).toMatchInlineSnapshot(
				`"SELECT "country", COUNT(*) FROM "artists" GROUP BY "country" HAVING (COUNT(*) > 5) AND (COUNT(*) < 100)"`,
			);
		});
	});

	describe("ordering", () => {
		test("single order by", () => {
			expect(toSql(from("t").orderBy("name"))).toMatchInlineSnapshot(
				`"SELECT * FROM "t" ORDER BY "name""`,
			);
		});

		test("orderBy is additive", () => {
			expect(toSql(from("t").orderBy("a").orderBy("b DESC"))).toMatchInlineSnapshot(
				`"SELECT * FROM "t" ORDER BY "a", "b" DESC"`,
			);
		});

		test("multiple columns in single call", () => {
			expect(toSql(from("t").orderBy("a", "b DESC"))).toMatchInlineSnapshot(
				`"SELECT * FROM "t" ORDER BY "a", "b" DESC"`,
			);
		});
	});

	describe("pagination", () => {
		test("limit", () => {
			expect(toSql(from("t").limit(10))).toMatchInlineSnapshot(`"SELECT * FROM "t" LIMIT 10"`);
		});

		test("offset", () => {
			expect(toSql(from("t").offset(20))).toMatchInlineSnapshot(`"SELECT * FROM "t" OFFSET 20"`);
		});

		test("limit and offset", () => {
			expect(toSql(from("t").limit(10).offset(20))).toMatchInlineSnapshot(
				`"SELECT * FROM "t" LIMIT 10 OFFSET 20"`,
			);
		});

		test("limit replaces previous limit", () => {
			expect(toSql(from("t").limit(10).limit(20))).toMatchInlineSnapshot(
				`"SELECT * FROM "t" LIMIT 20"`,
			);
		});
	});

	describe("modifiers", () => {
		test("distinct", () => {
			expect(toSql(from("t").select("country").distinct())).toMatchInlineSnapshot(
				`"SELECT DISTINCT "country" FROM "t""`,
			);
		});

		test("for update", () => {
			expect(toSql(from("t").forUpdate())).toMatchInlineSnapshot(`"SELECT * FROM "t" FOR UPDATE"`);
		});

		test("for update with option", () => {
			expect(toSql(from("t").forUpdate("NOWAIT"))).toMatchInlineSnapshot(
				`"SELECT * FROM "t" FOR UPDATE NOWAIT"`,
			);
		});

		test("for share", () => {
			expect(toSql(from("t").forShare())).toMatchInlineSnapshot(`"SELECT * FROM "t" FOR SHARE"`);
		});
	});

	describe("complex query", () => {
		test("query with all clauses", () => {
			expect(
				toSql(
					from("artists")
						.join("artworks aw ON aw.artist_id = artists.id")
						.leftJoin("galleries g ON g.id = aw.gallery_id")
						.select("artists.id", "artists.fullName", "aw.title")
						.where("artists.age > 30")
						.where("artists.status = 'active'")
						.groupBy("artists.id")
						.having("COUNT(*) > 1")
						.orderBy("artists.fullName")
						.orderBy("aw.year DESC")
						.limit(10)
						.offset(20)
						.distinct()
						.forUpdate(),
				),
			).toMatchInlineSnapshot(
				`"SELECT DISTINCT "artists"."id", "artists"."fullName", "aw"."title" FROM "artists" JOIN "artworks" "aw" ON "aw"."artist_id" = "artists"."id" LEFT JOIN "galleries" "g" ON "g"."id" = "aw"."gallery_id" WHERE ("artists"."age" > 30) AND ("artists"."status" = 'active') GROUP BY "artists"."id" HAVING (COUNT(*) > 1) ORDER BY "artists"."fullName", "aw"."year" DESC LIMIT 10 OFFSET 20 FOR UPDATE"`,
			);
		});
	});

	describe("Statement interface", () => {
		test("fragments contains compiled SQL", () => {
			const query = from("artists").where("age > 30");
			expect(query.fragments).toHaveLength(1);
			expect(query.fragments[0]).toContain("SELECT");
			expect(query.fragments[0]).toContain('FROM "artists"');
		});

		test("params is empty for milestone 1", () => {
			const query = from("artists").where("age > 30");
			expect(query.params).toEqual([]);
		});

		test("renderSql works with custom placeholder", () => {
			const query = from("artists");
			// For M1, no placeholders needed since no params
			expect(query.renderSql(() => "?")).toMatchInlineSnapshot(`"SELECT * FROM "artists""`);
		});

		test("renderForLogs works", () => {
			const query = from("artists");
			// For M1, same as toSql since no params
			expect(query.renderForLogs()).toMatchInlineSnapshot(`"SELECT * FROM "artists""`);
		});
	});
});
