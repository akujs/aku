/**
 * A typed key, used to look up a value in various contexts
 */
export type Key<T = unknown> = {
	readonly default: T | undefined;
	toString(): string;
};

class KeyImpl<T> implements Key<T> {
	#name: string;
	default: T | undefined;

	constructor(name: string, defaultValue?: T) {
		this.#name = name;
		this.default = defaultValue;
	}

	toString(): string {
		return `[${this.#name}]`;
	}
}

/**
 * Create a typed key, used to look up a value in various contexts
 *
 * @example
 * // Inferred type of port is Key<number | undefined> since it has no default value
 * export const port = key<number>();
 *
 * // With default value - the type will be inferred as Key<number>
 * export const port = key({ default: 3000 });
 *
 * // Optional name for debugging
 * export const port = key<number>({ displayName: "port" });
 *
 * @param options.displayName - A name to
 */
export function createKey(options?: { displayName?: string }): Key<unknown>;
export function createKey<T>(options?: { displayName?: string }): Key<T | undefined>;
export function createKey<T>(options: { displayName?: string; default: T }): Key<T>;
export function createKey<T = unknown>(
	options: { displayName?: string; default?: T } = {},
): Key<T> | Key<T | undefined> | Key<unknown> {
	const { displayName: name = "anonymous", default: defaultValue } = options;
	return new KeyImpl<T>(name, defaultValue);
}
