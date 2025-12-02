import type { TypeToken } from "../container/container-key.ts";
import { createTypeToken } from "../container/container-key.ts";

/**
 * The interface used by framework integrations to provide access to the request
 * and response
 */
export interface IntegrationContext {
	/**
	 * The name of the context, for debugging purposes. Should include framework
	 * name, and the kind of request, if the framework has multiple kinds of
	 * request. For example `"NextJS route handler"`
	 */
	readonly context: string;

	/**
	 * The request URL, used for URL generation fallback
	 */
	readonly requestUrl?: URL | null | undefined;

	/**
	 * A function to get a request header
	 *
	 * @param name The name of the header to retrieve, case-insensitive.
	 * @returns The header value or null if not present in the request.
	 */
	readonly getRequestHeader: (name: string) => string | null;

	/**
	 * A function returning an iterable of request header names. This can be an
	 * array of strings, or iterator
	 *
	 * @param name The name of the header to retrieve, case-insensitive.
	 * @returns The header value or null if not present in the request.
	 */
	readonly getRequestHeaderNames: () => Iterable<string>;

	/**
	 * Get the value of a request cookie
	 *
	 * @param name the name of the cookie, case-sensitive (NOTE: unlike headers,
	 *             cookie names are case-sensitive, which follows the HTTP spec)
	 */
	readonly getCookie: (name: string) => string | null;

	/**
	 * A function returning an iterable of cookie names from the request. This can
	 * be an array of strings, or iterator
	 */
	readonly getCookieNames: () => Iterable<string>;

	/**
	 * Add response header that deletes a cookie
	 *
	 * This will throw an error if the response headers have already been sent
	 *
	 * @param name the name of the cookie, case-sensitive (NOTE: unlike headers,
	 *             cookie names are case-sensitive, which follows the HTTP spec)
	 */
	readonly deleteCookie: ((name: string) => void) | null;

	/**
	 * A function that sets a cookie, or null if cookies can't be set in this context
	 */
	readonly setCookie: ((name: string, value: string, options?: CookieAttributes) => void) | null;

	/**
	 * A function to add a promise to keep the environment alive until it has
	 * completed. The integration should pass the promise to an environment
	 * primitive like waitUntil. If the environment is a long-running process
	 * like NodeJS this can be a no-op since the process stays alive by default
	 */
	readonly addKeepAliveTask: ((task: Promise<void>) => void) | null;
}

/***/
export const IntegrationContext: TypeToken<IntegrationContext> =
	createTypeToken<IntegrationContext>("IntegrationContext");

export interface CookieAttributes {
	/**
	 * Send the cookie to a specific domain and all its subdomains.
	 *
	 * By default, the cookie will only be sent in requests to the same domain
	 * that set the cookie, e.g. if `example.com`, `www.example.com` can not read
	 * it. Explicitly setting the domain to `example.com` will allow subdomains to
	 * read it.
	 *
	 * A subdomain can set a cookie for a parent domain to allow sibling domains
	 * to read it, for example, `api.example.com` can set a cookie for
	 * `example.com`, allowing `www.example.com` to read it.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#domaindomain-value
	 */
	domain?: string | undefined;

	/**
	 * Indicates the maximum lifetime of the cookie as an HTTP-date timestamp.
	 * See Date for the required formatting.
	 *
	 * If unspecified, the cookie becomes a session cookie. A session finishes
	 * when the client shuts down, after which the session cookie is removed.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#expiresdate
	 */
	expires?: Date | undefined;

	/**
	 * Forbids JavaScript from accessing the cookie, for example, through the
	 * Document.cookie property.
	 *
	 * IMPORTANT For security, Beynac sets this to true in production.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#httponly
	 */
	httpOnly?: boolean | undefined;

	/**
	 * Indicates the number of seconds until the cookie expires. A zero or
	 * negative number will expire the cookie immediately. If both Expires and
	 * Max-Age are set, Max-Age has precedence.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#max-agenumber
	 */
	maxAge?: number | undefined;

	/**
	 * Indicates that the cookie should be stored using partitioned storage. Note
	 * that if this is set, the Secure directive must also be set. See Cookies
	 * Having Independent Partitioned State (CHIPS) for more details.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#partitioned
	 */
	partitioned?: boolean | undefined;

	/**
	 * Indicates the path that must exist in the requested URL for the browser to
	 * send the Cookie header.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#pathpath-value
	 */
	path?: string | undefined;

	/**
	 * Controls whether or not a cookie is sent with cross-site requests: that is,
	 * requests originating from a different site, including the scheme, from the
	 * site that set the cookie. This provides some protection against certain
	 * cross-site attacks, including cross-site request forgery (CSRF) attacks.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value
	 */
	sameSite?: true | false | "lax" | "strict" | "none" | undefined;

	/**
	 * Indicates that the cookie is sent to the server only when a request is made
	 * with the https: scheme (except on localhost), and therefore, is more
	 * resistant to man-in-the-middle attacks.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#secure
	 */
	secure?: boolean | undefined;
}
