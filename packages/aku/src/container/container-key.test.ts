import { describe, expectTypeOf, it } from "bun:test";
import { createTypeToken, type TypeToken } from "./container-key.ts";

describe("type tokens", () => {
	it("createTypeToken() with no arguments infers TypeToken<unknown>", () => {
		const token = createTypeToken();
		expectTypeOf(token).toEqualTypeOf<TypeToken<unknown>>();
	});

	it("createTypeToken() with just name infers TypeToken<unknown>", () => {
		const token = createTypeToken("myToken");
		expectTypeOf(token).toEqualTypeOf<TypeToken<unknown>>();
	});

	it("createTypeToken<T>() infers TypeToken<T>", () => {
		const token1 = createTypeToken<string>();
		expectTypeOf(token1).toEqualTypeOf<TypeToken<string>>();

		const token2 = createTypeToken<string>("myToken");
		expectTypeOf(token2).toEqualTypeOf<TypeToken<string>>();

		const token3 = createTypeToken<number | null>();
		expectTypeOf(token3).toEqualTypeOf<TypeToken<number | null>>();
	});

	it("complex types work correctly", () => {
		interface User {
			name: string;
			age: number;
		}

		const token1 = createTypeToken<User>();
		expectTypeOf(token1).toEqualTypeOf<TypeToken<User>>();

		const token2 = createTypeToken<User>("User");
		expectTypeOf(token2).toEqualTypeOf<TypeToken<User>>();
	});

	it("union types work correctly", () => {
		const token1 = createTypeToken<string | number>();
		expectTypeOf(token1).toEqualTypeOf<TypeToken<string | number>>();

		const token2 = createTypeToken<string | number>("unionToken");
		expectTypeOf(token2).toEqualTypeOf<TypeToken<string | number>>();
	});

	it("nullable types work correctly", () => {
		const token1 = createTypeToken<string | null>("nullableToken");
		expectTypeOf(token1).toEqualTypeOf<TypeToken<string | null>>();

		const token2 = createTypeToken<string | null>();
		expectTypeOf(token2).toEqualTypeOf<TypeToken<string | null>>();
	});
});
