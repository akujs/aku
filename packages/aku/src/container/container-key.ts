import type { AnyConstructor } from "../utils.ts";

export type KeyOrClass<T = unknown> = AnyConstructor<T> | TypeToken<T>;

export const getKeyName = (key: KeyOrClass): string => {
	if (typeof key === "function") {
		return `[${key.name}]`;
	}
	return key?.toString() ?? "[unknown]";
};

const TYPE_TOKEN_BRAND: unique symbol = Symbol("TypeToken");

/**
 * A token representing an arbitrary type
 */
export type TypeToken<T = unknown> = {
	readonly [TYPE_TOKEN_BRAND]: T;
	toString(): string;
};

class TypeTokenImpl<T> implements TypeToken<T> {
	readonly [TYPE_TOKEN_BRAND]!: T;
	#name: string;

	constructor(name: string) {
		this.#name = name;
	}

	toString(): string {
		return `[${this.#name}]`;
	}
}

export const isTypeToken = (value: unknown): value is TypeToken => value instanceof TypeTokenImpl;

/**
 * Create a token representing an arbitrary type. This allows typescript types
 * that don't normally have a runtime value associated (like interfaces) to be
 * resolved in the IoC container.
 *
 * @example
 * export interface Ship {
 *     sail(): void;
 * }
 *
 * // When creating a token, the convention is to use the same name for the type and the token
 * export const Ship = createTypeToken<Ship>("Ship");
 *
 * @param displayName - Optional name for debugging
 */
export function createTypeToken<T = unknown>(displayName?: string): TypeToken<T> {
	return new TypeTokenImpl<T>(displayName ?? "anonymous");
}
