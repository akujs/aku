import { describe, expect, expectTypeOf, test } from "bun:test";
import { createKey } from "../core/Key.ts";
import { RequestLocalsImpl } from "./RequestLocalsImpl.ts";

describe(RequestLocalsImpl, () => {
	test("get returns undefined for unset keys", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey<string>();

		const result = locals.get(key);

		expect(result).toBeUndefined();
		expectTypeOf(result).toEqualTypeOf<string | undefined>();
	});

	test("get returns default value for unset keys with defaults", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey({ default: "default-value" });

		const result = locals.get(key);

		expect(result).toBe("default-value");
		expectTypeOf(result).toEqualTypeOf<string>();
	});

	test("set and get stores and retrieves values", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey<string>();

		locals.set(key, "test-value");
		const result = locals.get(key);

		expect(result).toBe("test-value");
		expectTypeOf(result).toEqualTypeOf<string | undefined>();
	});

	test("set overwrites previous values", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey<string>();

		locals.set(key, "first");
		locals.set(key, "second");

		expect(locals.get(key)).toBe("second");
	});

	test("has returns false for unset keys", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey<string>();

		expect(locals.has(key)).toBe(false);
	});

	test("has returns true for set keys", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey<string>();

		locals.set(key, "value");

		expect(locals.has(key)).toBe(true);
	});

	test("delete removes values", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey<string>();

		locals.set(key, "value");
		locals.delete(key);

		expect(locals.has(key)).toBe(false);
		expect(locals.get(key)).toBeUndefined();
	});

	test("delete on unset key does not throw", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey<string>();

		expect(() => locals.delete(key)).not.toThrow();
	});

	test("get returns default value even after delete", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey({ default: "default" });

		locals.set(key, "custom");
		expect(locals.get(key)).toBe("custom");

		locals.delete(key);
		expect(locals.get(key)).toBe("default");
	});

	test("has returns false for keys with defaults when not set", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey({ default: "default" });

		expect(locals.has(key)).toBe(false);
		expect(locals.get(key)).toBe("default");
	});

	test("has returns true after setting value on key with default", () => {
		const locals = new RequestLocalsImpl();
		const key = createKey({ default: "default" });

		locals.set(key, "custom");

		expect(locals.has(key)).toBe(true);
	});
});
