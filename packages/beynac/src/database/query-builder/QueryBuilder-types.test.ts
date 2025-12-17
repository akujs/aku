import { describe, test } from "bun:test";
import { SqliteGrammar } from "../grammar/SqliteGrammar.ts";
import type { QueryBuilder } from "../query-types.ts";
import { QueryBuilderImpl } from "./QueryBuilderImpl.ts";

function table(name: string): QueryBuilder {
	return QueryBuilderImpl.table(name, new SqliteGrammar());
}

describe("where()", () => {
	test("can chain to where()", () => {
		table("users").where("id = ?", 1).where("active = ?", true);
	});

	test("can chain to select()", () => {
		table("users").where("active = ?", true).select("id", "name");
	});

	test("can chain to orderBy()", () => {
		table("users").where("active = ?", true).orderBy("name");
	});

	test("can chain to deleteAll()", () => {
		table("users").where("active = ?", false).deleteAll();
	});

	test("can chain to updateAll()", () => {
		table("users").where("id = ?", 1).updateAll({ status: "archived" });
	});

	test("cannot chain to insert()", () => {
		table("users")
			.where("id = ?", 1)
			// @ts-expect-error
			.insert({ name: "Alice" });
	});
});

describe("select()", () => {
	test("can chain to where()", () => {
		table("users").select("id").where("active = ?", true);
	});

	test("can chain to select methods", () => {
		table("users").select("id").orderBy("name");
		table("users").select("id").limit(1);
		table("users").select("id").crossJoin("name");
		table("users").select("id").join("name");
	});

	test("can chain to modify the select columns", () => {
		table("users").select("id").addSelect("name");
		table("users").select("id", "name").replaceSelect("id");
	});

	test("cannot chain to call select twice", () => {
		table("users")
			.select("id")
			// @ts-expect-error
			.select("name");
		table("users")
			.select("id")
			.where("id")
			// @ts-expect-error
			.select("name");
		table("users")
			.select("id")
			.join("foo")
			// @ts-expect-error
			.select("name");
	});

	test("cannot chain to call select after addSelect / replaceSelect", () => {
		table("users")
			.addSelect("id")
			// @ts-expect-error
			.select("name");
		table("users")
			.replaceSelect("id")
			// @ts-expect-error
			.select("name");
	});

	test("cannot chain to insert()", () => {
		table("users")
			.select("id")
			// @ts-expect-error
			.insert({ name: "Alice" });
	});

	test("cannot chain to deleteAll()", () => {
		table("users")
			.select("id")
			// @ts-expect-error
			.deleteAll();
	});

	test("cannot chain to updateAll()", () => {
		table("users")
			.select("id")
			// @ts-expect-error
			.updateAll({ active: false });
	});
});

describe("select query methods", () => {
	test("orderBy() can chain to where()", () => {
		table("users").orderBy("name").where("id = ?", 1);
	});

	test("orderBy() can chain to select methods", () => {
		table("users").orderBy("name").select("id");
		table("users").orderBy("name").limit(10);
		table("users").limit(10).offset(5);
	});

	test("can chain to where()", () => {
		table("users").distinct().where("active = ?", true);
		table("users").having("").where("active = ?", true);
	});

	test("can chain to select()", () => {
		table("users").join("profiles ON profiles.user_id = users.id").select("users.id");
		table("users").groupBy("").select("users.id");
	});

	test("cannot chain to insert()", () => {
		table("users")
			.orderBy("name")
			// @ts-expect-error
			.insert({ name: "Alice" });
		table("users")
			.limit(10)
			// @ts-expect-error
			.insert({ name: "Alice" });
	});

	test("cannot chain to deleteAll()", () => {
		table("users")
			.offset(4)
			// @ts-expect-error
			.deleteAll();
		table("users")
			.rightJoin("foo")
			// @ts-expect-error
			.deleteAll();
	});

	test("cannot chain to updateAll()", () => {
		table("users")
			.orderBy("name")
			// @ts-expect-error
			.updateAll({ active: false });
	});

	test("cannot chain to insert()", () => {
		table("users")
			.limit(10)
			// @ts-expect-error
			.insert({ name: "Alice" });
	});

	test("can chain to addSelect() and replaceSelect()", () => {
		table("users").orderBy("name").addSelect("id");
		table("users").orderBy("name").replaceSelect("id");
		table("users").orderBy("name").select("id").addSelect("email");
	});
});

describe("insert()", () => {
	test("can chain to returning()", () => {
		table("users").insert({ name: "Alice" }).returning("id", "created_at");
	});

	test("can chain to returningId()", () => {
		table("users").insert({ name: "Alice" }).returningId();
	});

	test("returningId() accepts custom type parameter", () => {
		table("users").insert({ name: "Alice" }).returningId<string>();
	});

	test("cannot chain to where()", () => {
		table("users")
			.insert({ name: "Alice" })
			// @ts-expect-error
			.where("id = ?", 1);
	});

	test("cannot chain to select()", () => {
		table("users")
			.insert({ name: "Alice" })
			// @ts-expect-error
			.select("id");
	});

	test("returning() is not valid without insert()", () => {
		table("users").insert({}).returning();
		table("users")
			// @ts-expect-error
			.returning();

		table("users").insert({}).returning("id");
		table("users")
			// @ts-expect-error
			.returning("id");

		table("users").insert({}).returningId();
		table("users")
			// @ts-expect-error
			.returningId();
	});
});

describe("deleteAll()", () => {
	test("available on QueryBuilder", () => {
		table("users").deleteAll();
	});

	test("available after where()", () => {
		table("users").where("active = ?", false).deleteAll();
	});

	test("not available after select()", () => {
		table("users")
			.select("id")
			// @ts-expect-error
			.deleteAll();
	});

	test("not available after select query methods", () => {
		table("users")
			.orderBy("name")
			// @ts-expect-error
			.deleteAll();
		table("users")
			.limit(10)
			// @ts-expect-error
			.deleteAll();
	});

	test("not available after insert()", () => {
		table("users")
			.insert({ name: "Alice" })
			// @ts-expect-error
			.deleteAll();
	});
});

describe("updateAll()", () => {
	test("available on QueryBuilder", () => {
		table("users").updateAll({ active: false });
	});

	test("available after where()", () => {
		table("users").where("id = ?", 1).updateAll({ status: "archived" });
	});

	test("not available after select()", () => {
		table("users")
			.select("id")
			// @ts-expect-error
			.updateAll({ active: false });
	});

	test("not available after select query methods", () => {
		table("users")
			.orderBy("name")
			// @ts-expect-error
			.updateAll({ active: false });
		table("users")
			.distinct()
			// @ts-expect-error
			.updateAll({ active: false });
	});

	test("not available after insert()", () => {
		table("users")
			.insert({ name: "Alice" })
			// @ts-expect-error
			.updateAll({ active: false });
	});
});

describe("placeholder arity", () => {
	test("single placeholder with one value", () => {
		table("t").where("a = ?", 1);
	});

	test("multiple placeholders with matching values", () => {
		table("t").where("a = ? AND b = ?", 1, 2);
	});

	test("Statement argument as placeholder value", () => {
		const subquery = table("other").select("id");
		table("t").where("id IN ?", subquery);
	});

	test("too few values is rejected", () => {
		table("t")
			// @ts-expect-error
			.where("a = ? AND b = ?", 1);
	});

	test("too many values is rejected", () => {
		table("t")
			// @ts-expect-error
			.where("a = ?", 1, 2);
	});

	test("widened string allows any arity", () => {
		const condition = "a = ?" as string;
		table("t").where(condition);
		table("t").where(condition, 1);
		table("t").where(condition, 1, 2);
	});
});
