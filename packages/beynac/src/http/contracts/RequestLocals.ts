import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { Key } from "../../core/Key.ts";

/**
 * Type-safe storage for request-scoped data using typed keys
 *
 * RequestLocals provides a Map-like interface for storing and retrieving
 * request-specific data using typed keys created with createKey(). Each
 * request gets its own RequestLocals instance.
 *
 * @example
 * const requestLocaleKey = createKey<string>({ displayName: 'requestLocale' });
 * // early in request
 * locals.set(requestLocaleKey, "fr");
 * // later in request
 * const locale = locals.get(requestLocaleKey) ?? "en";
 */
export interface RequestLocals {
	/**
	 * Get a value from request-local storage
	 *
	 * @param key - Typed key created with createKey()
	 * @returns The stored value or undefined if not set
	 */
	get<T>(key: Key<T>): T | undefined;

	/**
	 * Store a value in request-local storage
	 *
	 * @param key - Typed key created with createKey()
	 * @param value - Value to store
	 */
	set<T>(key: Key<T>, value: T): void;

	/**
	 * Check if a key exists in request-local storage
	 *
	 * @param key - Key to check
	 * @returns True if the key has been set
	 */
	has(key: Key<unknown>): boolean;

	/**
	 * Delete a key from request-local storage
	 *
	 * @param key - Key to delete
	 */
	delete(key: Key<unknown>): void;
}

/***/
export const RequestLocals: TypeToken<RequestLocals> =
	createTypeToken<RequestLocals>("RequestLocals");
