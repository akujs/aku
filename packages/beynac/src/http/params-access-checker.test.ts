import { describe, expect, test } from "bun:test";
import { throwOnMissingPropertyAccess } from "./params-access-checker.ts";

describe("throwOnMissingPropertyAccess", () => {
	test("valid property access returns same value as plain object", () => {
		const plain = { id: "123", name: "test" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		expect(wrapped.id).toBe(plain.id);
		expect(wrapped.name).toBe(plain.name);
	});

	test("invalid property access throws, plain object returns undefined", () => {
		const plain: Record<string, unknown> = { id: "123" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		// Plain object returns undefined
		expect(plain.nonExistent).toBeUndefined();

		// Wrapped throws
		expect(() => wrapped.nonExistent).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("'in' operator behaves identically", () => {
		const plain = { id: "123", name: "test" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		expect("id" in wrapped).toBe("id" in plain);
		expect("name" in wrapped).toBe("name" in plain);
		expect("nonExistent" in wrapped).toBe("nonExistent" in plain);
	});

	test("Object.keys() returns identical results", () => {
		const plain = { id: "123", name: "test" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		expect(Object.keys(wrapped)).toEqual(Object.keys(plain));
	});

	test("Object.values() returns identical results", () => {
		const plain = { id: "123", name: "test" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		expect(Object.values(wrapped)).toEqual(Object.values(plain));
	});

	test("Object.entries() returns identical results", () => {
		const plain = { id: "123", name: "test" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		expect(Object.entries(wrapped)).toEqual(Object.entries(plain));
	});

	test("for...in iteration yields same keys", () => {
		const plain = { id: "123", name: "test" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		const plainKeys: string[] = [];
		for (const key in plain) {
			plainKeys.push(key);
		}

		const wrappedKeys: string[] = [];
		for (const key in wrapped) {
			wrappedKeys.push(key);
		}

		expect(wrappedKeys).toEqual(plainKeys);
	});

	test("spreading produces identical object", () => {
		const plain = { id: "123", name: "test" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		expect({ ...wrapped }).toEqual({ ...plain });
	});

	test("destructuring works with valid properties", () => {
		const wrapped = throwOnMissingPropertyAccess({ id: "123", name: "test" });
		const { id, name } = wrapped;

		expect(id).toBe("123");
		expect(name).toBe("test");
	});

	test("destructuring throws when accessing invalid property", () => {
		const wrapped: Record<string, unknown> = throwOnMissingPropertyAccess({});

		expect(() => {
			const { nonExistent } = wrapped;
			return nonExistent;
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("Object.getOwnPropertyDescriptor behaves identically", () => {
		const plain = { id: "123", name: "test" };
		const wrapped = throwOnMissingPropertyAccess(plain);

		const plainDesc = Object.getOwnPropertyDescriptor(plain, "id")!;
		const wrappedDesc = Object.getOwnPropertyDescriptor(wrapped, "id")!;

		// Both should be defined for existing properties
		expect(plainDesc).toBeDefined();
		expect(wrappedDesc).toBeDefined();
		expect(wrappedDesc).toEqual(plainDesc);

		// Both should return undefined for non-existent properties
		expect(Object.getOwnPropertyDescriptor(wrapped, "nonExistent")).toBeUndefined();
		expect(Object.getOwnPropertyDescriptor(plain, "nonExistent")).toBeUndefined();
	});

	test("empty object behaves identically", () => {
		const plain = {};
		const wrapped = throwOnMissingPropertyAccess(plain);

		expect(Object.keys(wrapped)).toEqual(Object.keys(plain));
		expect("anything" in wrapped).toBe("anything" in plain);
	});
});
