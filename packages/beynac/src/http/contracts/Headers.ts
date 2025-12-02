import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";

/**
 * Provides access to request headers
 */
export interface Headers {
	/**
	 * Get the number of headers in the request
	 */
	readonly size: number;

	/**
	 * Get the value of a request header
	 *
	 * @param name The name of the header to retrieve, case-insensitive.
	 * @returns The header value or null if not present in the request.
	 */
	get(name: string): string | null;

	/**
	 * Get all request header names, lower-cased
	 *
	 * @example
	 * // Iterate over headers
	 * for (const header of headers.keys()) {
	 *    console.log(`${header}: ${headers.get(header)}`);
	 * }
	 */
	keys(): ReadonlyArray<string>;

	/**
	 * Get all request header name/value pairs. Names are lower-cased.
	 *
	 * @returns an array of [string, string] pairs
	 *
	 * @example
	 * // Iterate over headers
	 * for (const [name, value] of Headers.entries()) {
	 *    console.log(`${name}: ${value}`);
	 * }
	 */
	entries(): ReadonlyArray<[string, string]>;

	/**
	 * True if headers can be set. May be false if response headers have already
	 * been sent to the browser or if you're in a context like NextJS server
	 * actions or server components where cookies can't be set.
	 */
	readonly canModify: boolean;

	/**
	 * Sets a header in the response
	 *
	 * This will throw an error if the response headers can't be changed, use
	 * canModify to check whether this is allowed
	 */
	set(name: string, value: string): void;
}

/***/
export const Headers: TypeToken<Headers> = createTypeToken("Headers");
