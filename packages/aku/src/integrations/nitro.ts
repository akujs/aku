import type { H3Event } from "h3";
import {
	defineEventHandler,
	deleteCookie,
	getRequestHeader,
	getRequestHeaders,
	parseCookies,
	setCookie,
	toWebRequest,
} from "h3";
import type { Application } from "../core/contracts/Application.ts";
import type { CookieAttributes, IntegrationContext } from "./IntegrationContext.ts";

/**
 * Create a Nitro/h3 event handler that delegates to an Aku application.
 *
 * Use this as a default export in a catch-all route to forward all matching
 * requests to Aku.
 *
 * @example
 * server/routes/aku/[...path].ts
 * import { makeEventHandler } from "@akujs/aku/integrations/nitro";
 * import { app } from "../../aku/app";
 *
 * export default makeEventHandler(app);
 */
export function makeEventHandler(app: Application): ReturnType<typeof defineEventHandler> {
	return defineEventHandler(async (event) => {
		const request = toWebRequest(event);
		const context = createContext(event);
		return app.handleRequest(request, context);
	});
}

function createContext(event: H3Event): IntegrationContext {
	return {
		context: "Nitro route handler",
		getRequestHeader(name) {
			return getRequestHeader(event, name) ?? null;
		},
		getRequestHeaderNames() {
			return Object.keys(getRequestHeaders(event));
		},
		getCookie(name) {
			return parseCookies(event)[name] ?? null;
		},
		getCookieNames() {
			return Object.keys(parseCookies(event));
		},
		setCookie: (name, value, options = {}) => {
			setCookie(event, name, value, mapCookieOptions(options));
		},
		deleteCookie: (name) => {
			deleteCookie(event, name);
		},
		addKeepAliveTask: null,
	};
}

function mapCookieOptions(options: CookieAttributes): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	if (options.domain !== undefined) result.domain = options.domain;
	if (options.expires !== undefined) result.expires = options.expires;
	if (options.httpOnly !== undefined) result.httpOnly = options.httpOnly;
	if (options.maxAge !== undefined) result.maxAge = options.maxAge;
	if (options.path !== undefined) result.path = options.path;
	if (options.secure !== undefined) result.secure = options.secure;
	if (options.partitioned !== undefined) result.partitioned = options.partitioned;
	if (options.sameSite !== undefined) {
		if (options.sameSite === true) {
			result.sameSite = "strict";
		} else if (options.sameSite === false) {
			result.sameSite = "none";
		} else {
			result.sameSite = options.sameSite;
		}
	}
	return result;
}
