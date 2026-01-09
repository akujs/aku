/**
 * Tests adapted from the clsx project (https://github.com/lukeed/clsx)
 * Original test suite by Luke Edwards
 * Licensed under MIT License
 */

import { describe, expect, test } from "bun:test";
import { classAttribute } from "./class-attribute.ts";

describe("classAttribute", () => {
	test("returns a string", () => {
		expect(typeof classAttribute()).toBe("string");
	});

	describe("strings", () => {
		test("handles empty string", () => {
			expect(classAttribute("")).toBe("");
		});

		test("handles single string", () => {
			expect(classAttribute("foo")).toBe("foo");
		});

		test("handles conditional strings", () => {
			const truthy = true;
			const falsy = false;
			expect(classAttribute(truthy && "foo")).toBe("foo");
			expect(classAttribute(falsy && "foo")).toBe("");
		});

		test("handles variadic string arguments", () => {
			const truthy = true;
			const falsy = false;
			expect(classAttribute("")).toBe("");
			expect(classAttribute("foo", "bar")).toBe("foo bar");
			expect(classAttribute(truthy && "foo", falsy && "bar", "baz")).toBe("foo baz");
			expect(classAttribute(falsy && "foo", "bar", "baz", "")).toBe("bar baz");
		});
	});

	describe("numbers", () => {
		test("converts numbers to strings", () => {
			expect(classAttribute(1)).toBe("1");
			expect(classAttribute(12)).toBe("12");
			expect(classAttribute(0.1)).toBe("0.1");
		});

		test("handles zero as empty", () => {
			expect(classAttribute(0)).toBe("");
		});

		test("handles special numeric values", () => {
			expect(classAttribute(Infinity)).toBe("Infinity");
			expect(classAttribute(NaN)).toBe("");
		});

		test("handles variadic number arguments", () => {
			expect(classAttribute(0, 1)).toBe("1");
			expect(classAttribute(1, 2)).toBe("1 2");
		});
	});

	describe("objects", () => {
		test("handles empty object", () => {
			expect(classAttribute({})).toBe("");
		});

		test("includes keys with truthy values", () => {
			expect(classAttribute({ foo: true })).toBe("foo");
			expect(classAttribute({ foo: true, bar: false })).toBe("foo");
			expect(classAttribute({ foo: "hiya", bar: 1 })).toBe("foo bar");
			expect(classAttribute({ foo: 1, bar: 0, baz: 1 })).toBe("foo baz");
		});

		test("handles keys with hyphens", () => {
			expect(classAttribute({ "-foo": 1, "--bar": 1 })).toBe("-foo --bar");
		});

		test("handles variadic object arguments", () => {
			expect(classAttribute({}, {})).toBe("");
			expect(classAttribute({ foo: 1 }, { bar: 2 })).toBe("foo bar");
			expect(classAttribute({ foo: 1 }, null, { baz: 1, bat: 0 })).toBe("foo baz");
			expect(classAttribute({ foo: 1 }, {}, {}, { bar: "a" }, { baz: null, bat: Infinity })).toBe(
				"foo bar bat",
			);
		});
	});

	describe("arrays", () => {
		test("handles empty array", () => {
			expect(classAttribute([])).toBe("");
		});

		test("handles simple arrays", () => {
			expect(classAttribute(["foo"])).toBe("foo");
			expect(classAttribute(["foo", "bar"])).toBe("foo bar");
			const zero = 0;
			const one = 1;
			expect(classAttribute(["foo", zero && "bar", one && "baz"])).toBe("foo baz");
		});

		test("handles nested arrays", () => {
			expect(classAttribute([[[]]])).toBe("");
			expect(classAttribute([[["foo"]]])).toBe("foo");
			expect(classAttribute([true, [["foo"]]])).toBe("foo");
			expect(classAttribute(["foo", ["bar", ["", [["baz"]]]]])).toBe("foo bar baz");
		});

		test("handles variadic array arguments", () => {
			expect(classAttribute([], [])).toBe("");
			expect(classAttribute(["foo"], ["bar"])).toBe("foo bar");
			expect(classAttribute(["foo"], null, ["baz", ""], true, "", [])).toBe("foo baz");
		});

		test("no push escape - handles array-like method names", () => {
			expect(classAttribute({ push: 1 })).toBe("push");
			expect(classAttribute({ pop: true })).toBe("pop");
			expect(classAttribute({ push: true })).toBe("push");
			expect(classAttribute("hello", { world: 1, push: true })).toBe("hello world push");
		});
	});

	describe("functions", () => {
		test("ignores functions", () => {
			const foo = (() => {}) as unknown as string;
			expect(classAttribute(foo, "hello")).toBe("hello");
			expect(classAttribute(foo, "hello", [[foo], "world"])).toBe("hello world");
		});
	});

	describe("mixed types", () => {
		test("handles complex mixed arguments", () => {
			expect(
				classAttribute(
					"foo",
					{ bar: true, baz: false },
					["qux", null, { quux: true }],
					undefined,
					null,
					0,
					1,
				),
			).toBe("foo bar qux quux 1");
		});

		test("handles deeply nested structures", () => {
			expect(
				classAttribute({
					foo: [1, { bar: [2, { baz: { qux: [3, { quux: 4 }] } }] }, { quuz: [] }],
				}),
			).toBe("foo");
		});
	});
});
