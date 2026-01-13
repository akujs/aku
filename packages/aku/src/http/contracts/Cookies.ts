import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { CookieAttributes } from "../../integrations/IntegrationContext.ts";

/***/
export interface Cookies {
	/**
	 * Get the number of cookies in the request
	 */
	readonly size: number;

	/**
	 * Get the value of a request cookie
	 *
	 * @param name the name of the cookie, case-sensitive (NOTE: unlike headers,
	 *             cookie names are case-sensitive, which follows the HTTP spec)
	 * @returns The cookie value or null if not present in the request.
	 */
	get(name: string): string | null;

	/**
	 * Get all cookie names present in the request
	 */
	keys(): ReadonlyArray<string>;

	/**
	 * Get all cookie name/value pairs
	 *
	 * @example
	 * // Iterate over cookies
	 * for (const [name, value] of Cookies.entries()) {
	 *    console.log(`${name}: ${value}`);
	 * }
	 */
	entries(): ReadonlyArray<readonly [string, string]>;

	/**
	 * True if cookies can be set and deleted. May be false if response headers
	 * have already been sent to the browser or if you're in a context like NextJS
	 * server components where headers are read-only.
	 */
	readonly canModify: boolean;

	/**
	 * Add response header that deletes a cookie
	 *
	 * This will throw an error if the response headers can't be set, use
	 * canModify to check whether this is allowed
	 *
	 * @param name the name of the cookie, case-sensitive (NOTE: unlike headers,
	 *             cookie names are case-sensitive, which follows the HTTP spec)
	 */
	delete(name: string): void;

	/**
	 * Sets a cookie
	 *
	 * This will throw an error if the response headers can't be changed, use
	 * canModify to check whether this is allowed
	 */
	set(name: string, value: string, options?: CookieAttributes): void;
}

/***/
export const Cookies: TypeToken<Cookies> = createTypeToken("Cookies");
