import { cookies, headers } from "next/headers";
import { after } from "next/server";
import type { Application } from "../core/contracts/Application.ts";
import type { IntegrationContext } from "./IntegrationContext.ts";

type AppRouterHandler = (req: Request) => Promise<Response>;

type Verb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

/**
 * Create a single NextJS router handler
 *
 * @see https://nextjs.org/docs/app/getting-started/route-handlers-and-middleware
 *
 * @example
 * import { app } from "@/aku/app";
 * import { makeRouteHandler } from "aku/integrations/next";
 *
 * // Only handle GET requests
 * export const GET = makeRouteHandler(app);
 */
export const makeRouteHandler = (app: Application): AppRouterHandler => {
	return async (request) => {
		const context = await createContext("route handler", true);
		return await app.handleRequest(request, context);
	};
};

/**
 * Create a NextJS route handler for all HTTP verbs
 *
 * @see https://nextjs.org/docs/app/getting-started/route-handlers-and-middleware
 *
 * @example
 * import { app } from "@/aku/app";
 * import { makeRouteHandlers } from "aku/integrations/next";
 *
 * // Handle all HTTP verbs
 * export const { GET, POST, PUT, DELETE, PATCH, OPTIONS } = makeRouteHandlers(app);
 */
export const makeRouteHandlers = (app: Application): Record<Verb, AppRouterHandler> => {
	const handler = makeRouteHandler(app);
	return {
		GET: handler,
		POST: handler,
		PUT: handler,
		DELETE: handler,
		PATCH: handler,
		OPTIONS: handler,
	};
};

/***/
export const wrapRouteHandler = <A extends unknown[], R>(
	handler: (...args: A) => R,
): ((...args: A) => R) => {
	return (...args: A) => {
		return handler(...args);
	};
};

const createContext = async (
	context: string,
	allowSetCookie: boolean,
): Promise<IntegrationContext> => {
	const nextHeaders = await headers();
	const nextCookies = await cookies();
	return {
		context: `NextJS ${context}`,
		getCookie(name) {
			return nextCookies.get(name)?.value ?? null;
		},
		getCookieNames() {
			return nextCookies.getAll().map(({ name }) => name);
		},
		deleteCookie: allowSetCookie
			? (name) => {
					nextCookies.delete(name);
				}
			: null,
		setCookie: allowSetCookie
			? (name, value, options = {}) => {
					nextCookies.set(name, value, options);
				}
			: null,
		getRequestHeader(name) {
			return nextHeaders.get(name);
		},
		getRequestHeaderNames() {
			return nextHeaders.keys();
		},
		addKeepAliveTask(task) {
			after(task);
		},
	};
};
