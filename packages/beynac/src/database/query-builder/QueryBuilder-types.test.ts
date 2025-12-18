import { describe, expect, test } from "bun:test";
import { SqliteGrammar } from "../grammar/SqliteGrammar.ts";
import type { QueryBuilder } from "../query-types.ts";
import { QueryBuilderImpl } from "./QueryBuilderImpl.ts";

const stubClient = {
	run: () => Promise.resolve({ rows: [], rowsAffected: 0 }),
	all: () => Promise.resolve([]),
	column: () => Promise.resolve([]),
};

function table(name: string): QueryBuilder {
	return QueryBuilderImpl.table(name, new SqliteGrammar(), stubClient as never);
}

describe("where()", () => {
	test("can chain to where()", () => {
		table("").where("").where("");
	});

	test("can chain to select()", () => {
		table("").where("").select("");
	});

	test("can chain to orderBy()", () => {
		table("").where("").orderBy("");
	});

	test("can chain to deleteAll()", () => {
		void table("").where("").deleteAll();
	});

	test("can chain to updateAll()", () => {
		void table("").where("").updateAll({});
	});

	test("cannot chain to insert()", () => {
		table("")
			.where("")
			// @ts-expect-error
			.insert({});
	});
});

describe("select()", () => {
	test("can chain to where()", () => {
		table("").select("").where("");
	});

	test("can chain to select methods", () => {
		table("").select("").orderBy("");
		table("").select("").limit(1);
		table("").select("").crossJoin("");
		table("").select("").join("");
	});

	test("can chain to modify the select columns", () => {
		table("").select("").addSelect("");
		table("").select("", "").replaceSelect("");
	});

	test("cannot chain to call select twice", () => {
		table("")
			.select("")
			// @ts-expect-error
			.select("");
		table("")
			.select("")
			.where("")
			// @ts-expect-error
			.select("");
		table("")
			.select("")
			.join("")
			// @ts-expect-error
			.select("");
	});

	test("cannot chain to call select after addSelect / replaceSelect", () => {
		table("")
			.addSelect("")
			// @ts-expect-error
			.select("");
		table("")
			.replaceSelect("")
			// @ts-expect-error
			.select("");
	});

	test("cannot chain to insert()", () => {
		table("")
			.select("")
			// @ts-expect-error
			.insert({});
	});

	test("cannot chain to deleteAll()", () => {
		table("")
			.select("")
			// @ts-expect-error
			.deleteAll();
	});

	test("cannot chain to updateAll()", () => {
		table("")
			.select("")
			// @ts-expect-error
			.updateAll({});
	});
});

describe("orderBy()", () => {
	test("can chain to where()", () => {
		table("").orderBy("").where("");
	});

	test("can chain to select methods", () => {
		table("").orderBy("").select("");
		table("").orderBy("").limit(10);
		table("").limit(10).offset(5);
	});

	test("can chain to modify the order by columns", () => {
		table("").orderBy("").addOrderBy("");
		table("").orderBy("", "").replaceOrderBy("");
	});

	test("cannot chain to call orderBy twice", () => {
		table("")
			.orderBy("")
			// @ts-expect-error
			.orderBy("");
		table("")
			.orderBy("")
			.where("")
			// @ts-expect-error
			.orderBy("");
		table("")
			.orderBy("")
			.join("")
			// @ts-expect-error
			.orderBy("");
	});

	test("cannot chain to call orderBy after addOrderBy / replaceOrderBy", () => {
		table("")
			.addOrderBy("")
			// @ts-expect-error
			.orderBy("");
		table("")
			.replaceOrderBy("")
			// @ts-expect-error
			.orderBy("");
	});

	test("cannot chain to insert()", () => {
		table("")
			.orderBy("")
			// @ts-expect-error
			.insert({});
	});

	test("cannot chain to deleteAll()", () => {
		table("")
			.orderBy("")
			// @ts-expect-error
			.deleteAll();
	});

	test("cannot chain to updateAll()", () => {
		table("")
			.orderBy("")
			// @ts-expect-error
			.updateAll({});
	});
});

describe("other select query methods", () => {
	test("can chain to where()", () => {
		table("").distinct().where("");
		table("").having("").where("");
	});

	test("can chain to select()", () => {
		table("").join("").select("");
		table("").groupBy("").select("");
	});

	test("can chain to orderBy()", () => {
		table("").distinct().orderBy("");
		table("").limit(10).orderBy("");
	});

	test("cannot chain to insert()", () => {
		table("")
			.limit(10)
			// @ts-expect-error
			.insert({});
		table("")
			.distinct()
			// @ts-expect-error
			.insert({});
	});

	test("cannot chain to deleteAll()", () => {
		table("")
			.offset(4)
			// @ts-expect-error
			.deleteAll();
		table("")
			.rightJoin("")
			// @ts-expect-error
			.deleteAll();
	});

	test("cannot chain to updateAll()", () => {
		table("")
			.distinct()
			// @ts-expect-error
			.updateAll({});
		table("")
			.limit(10)
			// @ts-expect-error
			.updateAll({});
	});

	test("can chain to addSelect() and replaceSelect()", () => {
		table("").distinct().addSelect("");
		table("").limit(10).replaceSelect("");
	});

	test("can chain to addOrderBy() and replaceOrderBy()", () => {
		table("").distinct().addOrderBy("");
		table("").limit(10).replaceOrderBy("");
	});
});

describe("insert()", () => {
	test("can chain to returning()", () => {
		void table("").insert({}).returning("", "");
	});

	test("can chain to returningId()", () => {
		void table("").insert({}).returningId();
	});

	test("cannot chain to where()", () => {
		table("")
			.insert({})
			// @ts-expect-error
			.where("");
	});

	test("cannot chain to select()", () => {
		table("")
			.insert({})
			// @ts-expect-error
			.select("");
	});

	test("returning() is not valid without insert()", () => {
		void table("").insert({}).returning();
		table("")
			// @ts-expect-error
			.returning();

		void table("").insert({}).returning("");
		table("")
			// @ts-expect-error
			.returning("");

		void table("").insert({}).returningId();
		table("")
			// @ts-expect-error
			.returningId();
	});
});

describe("deleteAll()", () => {
	test("available on QueryBuilder", () => {
		void table("").deleteAll();
	});

	test("available after where()", () => {
		void table("").where("").deleteAll();
	});

	test("not available after select()", () => {
		table("")
			.select("")
			// @ts-expect-error
			.deleteAll();
	});

	test("not available after select query methods", () => {
		table("")
			.orderBy("")
			// @ts-expect-error
			.deleteAll();
		table("")
			.limit(10)
			// @ts-expect-error
			.deleteAll();
	});

	test("not available after insert()", () => {
		table("")
			.insert({})
			// @ts-expect-error
			.deleteAll();
	});
});

describe("updateAll()", () => {
	test("available on QueryBuilder", () => {
		void table("").updateAll({});
	});

	test("available after where()", () => {
		void table("").where("").updateAll({});
	});

	test("not available after select()", () => {
		table("")
			.select("")
			// @ts-expect-error
			.updateAll({});
	});

	test("not available after select query methods", () => {
		table("")
			.orderBy("")
			// @ts-expect-error
			.updateAll({});
		table("")
			.distinct()
			// @ts-expect-error
			.updateAll({});
	});

	test("not available after insert()", () => {
		table("")
			.insert({})
			// @ts-expect-error
			.updateAll({});
	});
});

describe("placeholder arity", () => {
	test("single placeholder with one value", () => {
		table("").where("?", 1);
	});

	test("multiple placeholders with matching values", () => {
		table("").where("? ?", 1, 2);
	});

	test("Statement argument as placeholder value", () => {
		const subquery = table("").select("");
		table("").where("?", subquery);
	});

	test("too few values is rejected", () => {
		expect(() =>
			table("")
				// @ts-expect-error
				.where("? ?", 1),
		).toThrow();
	});

	test("too many values is rejected", () => {
		expect(() =>
			table("")
				// @ts-expect-error
				.where("?", 1, 2),
		).toThrow();
	});

	test("widened string allows any arity at type level", () => {
		const condition = "?" as string;
		// TypeScript allows any arity when string is widened, but runtime still validates
		expect(() => table("").where(condition)).toThrow();
		table("").where(condition, 1); // This one matches at runtime
		expect(() => table("").where(condition, 1, 2)).toThrow();
	});
});
