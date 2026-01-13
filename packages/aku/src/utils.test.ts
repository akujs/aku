import { describe, expect, test } from "bun:test";
import { sleep } from "./helpers/async/sleep.ts";
import { getPrototypeChain, StringKeyWeakMap } from "./utils.ts";

describe(getPrototypeChain, () => {
	class A {}
	class B extends A {}
	class C extends B {}

	test("work with instance", () => {
		const chain = getPrototypeChain(new C());
		expect(chain).toEqual([C, B, A, Object]);
	});

	test("work with classes", () => {
		const chain = getPrototypeChain(C);
		expect(chain).toEqual([C, B, A, Object]);
	});

	test("work with null", () => {
		const chain = getPrototypeChain(null);
		expect(chain).toEqual([]);
	});

	test("work with primitive", () => {
		const chain = getPrototypeChain(4);
		expect(chain).toEqual([Number, Object]);
	});
});

describe(StringKeyWeakMap, () => {
	test("returns undefined for missing keys", () => {
		const map = new StringKeyWeakMap<object>();
		expect(map.get("missing")).toBeUndefined();
		expect(map.has("missing")).toBe(false);
	});

	test("stores and retrieves values", () => {
		const map = new StringKeyWeakMap<object>();
		const obj = { value: 42 };

		map.set("key", obj);

		expect(map.get("key")).toBe(obj);
		expect(map.has("key")).toBe(true);
	});

	test("overwrites existing values", () => {
		const map = new StringKeyWeakMap<object>();
		const obj1 = { value: 1 };
		const obj2 = { value: 2 };

		map.set("key", obj1);
		map.set("key", obj2);

		expect(map.get("key")).toBe(obj2);
	});

	test("handles multiple keys independently", () => {
		const map = new StringKeyWeakMap<object>();
		const obj1 = { value: 1 };
		const obj2 = { value: 2 };

		map.set("key1", obj1);
		map.set("key2", obj2);

		expect(map.get("key1")).toBe(obj1);
		expect(map.get("key2")).toBe(obj2);
	});

	test("delete removes entries", () => {
		const map = new StringKeyWeakMap<object>();
		const obj = { value: 42 };

		map.set("key", obj);
		expect(map.has("key")).toBe(true);

		map.delete("key");
		expect(map.has("key")).toBe(false);
		expect(map.get("key")).toBeUndefined();
	});

	test("delete returns true for existing keys", () => {
		const map = new StringKeyWeakMap<object>();
		map.set("key", { value: 42 });

		expect(map.delete("key")).toBe(true);
	});

	test("delete returns false for missing keys", () => {
		const map = new StringKeyWeakMap<object>();

		expect(map.delete("missing")).toBe(false);
	});

	test("GC removes entries", async () => {
		const map = new StringKeyWeakMap<object>();
		let value: object | null = { value: 42 };
		map.set("key", value);
		expect(map.has("key")).toBe(true);
		value = null;
		while (map.has("key")) {
			Bun.gc(true);
			await sleep(0);
		}
		expect(map.has("key")).toBe(false);
	});
});
