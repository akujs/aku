import { describe, expect, test } from "bun:test";
import { SqliteGrammar } from "../grammar/SqliteGrammar.ts";
import type { QueryBuilder } from "../query-types.ts";
import { QueryBuilderImpl } from "./QueryBuilderImpl.ts";

const stubClient = {
	run: () => Promise.resolve({ rows: [], rowsAffected: 0 }),
	getAll: () => Promise.resolve([]),
	getColumn: () => Promise.resolve([]),
	getFirstOrNull: () => Promise.resolve(null),
	getFirstOrFail: () => Promise.resolve({}),
	getFirstOrNotFound: () => Promise.resolve({}),
	getScalar: () => Promise.resolve(null),
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

	test("can chain to returning()", () => {
		void table("").deleteAll().returning("id");
	});

	test("can chain to returningId()", () => {
		void table("").deleteAll().returningId();
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

	test("cannot chain to where() after deleteAll()", () => {
		table("")
			.deleteAll()
			// @ts-expect-error
			.where("");
	});

	test("cannot chain to select() after deleteAll()", () => {
		table("")
			.deleteAll()
			// @ts-expect-error
			.select("");
	});
});

describe("updateAll()", () => {
	test("available on QueryBuilder", () => {
		void table("").updateAll({});
	});

	test("available after where()", () => {
		void table("").where("").updateAll({});
	});

	test("can chain to returning()", () => {
		void table("").updateAll({}).returning("id");
	});

	test("can chain to returningId()", () => {
		void table("").updateAll({}).returningId();
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

	test("cannot chain to where() after updateAll()", () => {
		table("")
			.updateAll({})
			// @ts-expect-error
			.where("");
	});

	test("cannot chain to select() after updateAll()", () => {
		table("")
			.updateAll({})
			// @ts-expect-error
			.select("");
	});
});

describe("updateFrom()", () => {
	test("can chain to returning()", () => {
		void table("")
			.updateFrom([{ id: 1 }])
			.returning("id");
	});

	test("can chain to returningId()", () => {
		void table("")
			.updateFrom([{ id: 1 }])
			.returningId();
	});

	test("cannot chain to where() after updateFrom()", () => {
		table("")
			.updateFrom([{ id: 1 }])
			// @ts-expect-error
			.where("");
	});

	test("cannot chain to select() after updateFrom()", () => {
		table("")
			.updateFrom([{ id: 1 }])
			// @ts-expect-error
			.select("");
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

describe("getByIdOrXXX()", () => {
	test("available on QueryBuilder and return Promises", () => {
		void table("").getByIdOrFail(1);
		void table("").getByIdOrNotFound(1);
		void table("").getByIdOrNull(1);
	});

	test("available after where()", () => {
		void table("").where("").getByIdOrFail(1);
		void table("").where("").getByIdOrNotFound(1);
		void table("").where("").getByIdOrNull(1);
	});

	test("available after select()", () => {
		void table("").select("").getByIdOrFail(1);
		void table("").select("").getByIdOrNotFound(1);
		void table("").select("").getByIdOrNull(1);
	});

	test("available after orderBy() and limit()", () => {
		void table("").orderBy("").getByIdOrFail(1);
		void table("").limit(10).getByIdOrFail(1);
	});
});

describe("terminal method restrictions", () => {
	test("deleteAll() can use run()", () => {
		const _run: () => Promise<unknown> = table("").deleteAll().run;
		void _run;
	});

	test("deleteAll() cannot use getAll()", () => {
		void table("")
			.deleteAll()
			// @ts-expect-error
			.getAll();
	});

	test("deleteAll() cannot use getScalar()", () => {
		void table("")
			.deleteAll()
			// @ts-expect-error
			.getScalar();
	});

	test("insert() can use run()", () => {
		const _run: () => Promise<unknown> = table("").insert({}).run;
		void _run;
	});

	test("insert() cannot use getAll()", () => {
		void table("")
			.insert({})
			// @ts-expect-error
			.getAll();
	});

	test("insert() cannot use getFirstOrFail()", () => {
		void table("")
			.insert({})
			// @ts-expect-error
			.getFirstOrFail();
	});

	test("returning() can use getAll()", () => {
		void table("").insert({}).returning("id").getAll();
	});

	test("returning() can use getScalar()", () => {
		void table("").insert({}).returning("id").getScalar();
	});

	test("returning() can use getColumn()", () => {
		void table("").insert({}).returning("id").getColumn();
	});

	test("returning() can use getFirstOrFail()", () => {
		void table("").insert({}).returning("id").getFirstOrFail();
	});

	test("returning() can use getFirstOrNull()", () => {
		void table("").insert({}).returning("id").getFirstOrNull();
	});
});

describe("union() and unionAll()", () => {
	test("available on QueryBuilder", () => {
		table("").union(table(""));
		table("").unionAll(table(""));
	});

	test("available after where()", () => {
		table("").where("").union(table(""));
	});

	test("available after select()", () => {
		table("").select("").union(table(""));
	});

	test("available after orderBy()", () => {
		table("").orderBy("").union(table(""));
	});

	test("can chain multiple unions mixing union and unionAll", () => {
		table("").union(table("")).unionAll(table("")).union(table(""));
	});

	test("can chain to orderBy()", () => {
		table("").union(table("")).orderBy("");
		table("").unionAll(table("")).orderBy("");
	});

	test("can chain to limit() and offset()", () => {
		table("").union(table("")).limit(10).offset(5);
	});

	test("cannot call orderBy() twice on union", () => {
		table("")
			.union(table(""))
			.orderBy("")
			// @ts-expect-error
			.orderBy("");
	});

	test("can call addOrderBy() after orderBy() on union", () => {
		table("").union(table("")).orderBy("").addOrderBy("");
	});

	test("can call replaceOrderBy() after orderBy() on union", () => {
		table("").union(table("")).orderBy("").replaceOrderBy("");
	});

	test("cannot chain to where()", () => {
		table("")
			.union(table(""))
			// @ts-expect-error
			.where("");
	});

	test("cannot chain to select()", () => {
		table("")
			.union(table(""))
			// @ts-expect-error
			.select("");
	});

	test("cannot chain to join()", () => {
		table("")
			.union(table(""))
			// @ts-expect-error
			.join("");
	});

	test("cannot chain to groupBy()", () => {
		table("")
			.union(table(""))
			// @ts-expect-error
			.groupBy("");
	});

	test("cannot chain to insert()", () => {
		table("")
			.union(table(""))
			// @ts-expect-error
			.insert({});
	});

	test("cannot chain to deleteAll()", () => {
		table("")
			.union(table(""))
			// @ts-expect-error
			.deleteAll();
	});

	test("cannot chain to updateAll()", () => {
		table("")
			.union(table(""))
			// @ts-expect-error
			.updateAll({});
	});

	test("not available after insert()", () => {
		table("")
			.insert({})
			// @ts-expect-error
			.union(table(""));
	});

	test("not available after deleteAll()", () => {
		table("")
			.deleteAll()
			// @ts-expect-error
			.union(table(""));
	});

	test("not available after updateAll()", () => {
		table("")
			.updateAll({})
			// @ts-expect-error
			.union(table(""));
	});

	test("unionAll has same restrictions as union", () => {
		table("")
			.unionAll(table(""))
			// @ts-expect-error
			.where("");
		table("")
			.unionAll(table(""))
			// @ts-expect-error
			.select("");
	});
});

describe("aggregate methods", () => {
	test("aggregate methods available on root query builder and return Promises", () => {
		void table("").getCount();
		void table("").getCount("col");
		void table("").getMin("col");
		void table("").getMax("col");
		// @ts-expect-error - getSum requires a column argument
		void table("").getSum();
	});

	test("available on select queries", () => {
		const p1: Promise<number> = table("").where("").getCount();
		const p2: Promise<number> = table("").select("").getCount();
		void p1;
		void p2;
	});

	test("not available after insert or mutations", () => {
		table("")
			.insert({})
			// @ts-expect-error
			.getCount();
		table("")
			.deleteAll()
			// @ts-expect-error
			.getCount();
		table("")
			.union(table(""))
			// @ts-expect-error
			.getCount();
	});
});
