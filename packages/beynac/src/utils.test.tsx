/** @jsxRuntime automatic **/
/** @jsxImportSource beynac/view **/
import { describe, expect, test } from "bun:test";
import { getPrototypeChain } from "./utils.ts";

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
