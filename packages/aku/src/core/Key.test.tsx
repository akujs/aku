/** @jsxRuntime automatic **/
/** @jsxImportSource aku/view **/
import { describe, expectTypeOf, it } from "bun:test";
import { createKey, type Key } from "./Key.ts";

describe(createKey, () => {
	it("createKey() with no arguments infers Key<unknown>", () => {
		const k = createKey();
		expectTypeOf(k).toEqualTypeOf<Key<unknown>>();
	});

	it("createKey() with just name infers Key<unknown>", () => {
		const k = createKey({ displayName: "myKey" });
		expectTypeOf(k).toEqualTypeOf<Key<unknown>>();
	});

	it("createKey() with default value infers type from default", () => {
		const k1 = createKey({ default: 4 });
		expectTypeOf(k1).toEqualTypeOf<Key<number>>();

		const k2 = createKey({ displayName: "myKey", default: "hello" });
		expectTypeOf(k2).toEqualTypeOf<Key<string>>();

		const k3 = createKey({ default: true });
		expectTypeOf(k3).toEqualTypeOf<Key<boolean>>();

		const k4 = createKey({ default: null });
		expectTypeOf(k4).toEqualTypeOf<Key<null>>();
	});

	it("createKey<T>() with no default infers Key<T | undefined>", () => {
		const k1 = createKey<string>();
		expectTypeOf(k1).toEqualTypeOf<Key<string | undefined>>();

		const k2 = createKey<string>({ displayName: "myKey" });
		expectTypeOf(k2).toEqualTypeOf<Key<string | undefined>>();

		const k3 = createKey<number | null>();
		expectTypeOf(k3).toEqualTypeOf<Key<number | null | undefined>>();
	});

	it("createKey<T>() with matching default infers Key<T>", () => {
		const k1 = createKey<string>({ default: "hello" });
		expectTypeOf(k1).toEqualTypeOf<Key<string>>();

		const k2 = createKey<number>({ displayName: "port", default: 3000 });
		expectTypeOf(k2).toEqualTypeOf<Key<number>>();
	});

	it("createKey<T>() with mismatched default causes type error", () => {
		// @ts-expect-error - default value must match type parameter
		const _k1 = createKey<string>({ default: 42 });

		// @ts-expect-error - default value must match type parameter
		const _k2 = createKey<boolean>({ default: "not a boolean" });
	});

	it("complex types work correctly", () => {
		interface User {
			name: string;
			age: number;
		}

		const k1 = createKey<User>();
		expectTypeOf(k1).toEqualTypeOf<Key<User | undefined>>();

		const k2 = createKey<User>({ default: { name: "Alice", age: 30 } });
		expectTypeOf(k2).toEqualTypeOf<Key<User>>();

		const k3 = createKey({ default: { name: "Bob", age: 25 } });
		expectTypeOf(k3).toEqualTypeOf<Key<{ name: string; age: number }>>();
	});

	it("union types work correctly", () => {
		const k1 = createKey<string | number>();
		expectTypeOf(k1).toEqualTypeOf<Key<string | number | undefined>>();

		const k2 = createKey<string | number>({ default: "hello" });
		expectTypeOf(k2).toEqualTypeOf<Key<string | number>>();

		const k3 = createKey<string | number>({ default: 42 });
		expectTypeOf(k3).toEqualTypeOf<Key<string | number>>();
	});

	it("nullable types work correctly", () => {
		const k1 = createKey<string | null>({ default: null });
		expectTypeOf(k1).toEqualTypeOf<Key<string | null>>();

		const k2 = createKey<string | null>();
		expectTypeOf(k2).toEqualTypeOf<Key<string | null | undefined>>();
	});
});
