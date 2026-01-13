import { inject } from "../container/inject.ts";
import { Configuration } from "../core/contracts/Configuration.ts";
import { BaseClass } from "../utils.ts";
import { DEFAULT_MIDDLEWARE_PRIORITY } from "./default-middleware-priority.ts";
import type { MiddlewareReference } from "./Middleware.ts";
import { MiddlewarePriorityBuilder } from "./MiddlewarePriorityBuilder.ts";
import { addRoute } from "./matcher/add-route.ts";
import { createMatcher } from "./matcher/create-matcher.ts";
import { findRoute } from "./matcher/find-route.ts";
import type { MatcherContext } from "./matcher/types.ts";
import type {
	BuiltInRouteConstraint,
	ParamConstraint,
	RouteDefinition,
	Routes,
	RouteWithParams,
} from "./router-types.ts";

export class Router extends BaseClass {
	#matcher: MatcherContext<{ route: RouteDefinition }>;
	#middlewarePriority: MiddlewareReference[];
	#sortedMiddlewareSets = new WeakSet();
	#config: Configuration;

	constructor(config: Configuration = inject(Configuration)) {
		super();
		this.#config = config;
		this.#matcher = createMatcher<{ route: RouteDefinition }>();
		this.#middlewarePriority = this.#resolveMiddlewarePriority();
	}

	/**
	 * Register routes with the router
	 */
	register(routes: Routes): void {
		for (const route of routes) {
			for (const method of route.methods) {
				addRoute(this.#matcher, method, route.path, { route }, route.domainPattern);
			}

			// Apply priority sorting once per MiddlewareSet instance
			if (route.middleware && !this.#sortedMiddlewareSets.has(route.middleware)) {
				route.middleware.applyPriority(this.#middlewarePriority);
				this.#sortedMiddlewareSets.add(route.middleware);
			}
		}
	}

	/**
	 * Look up a route for the given request
	 * @returns The matched route with request, URL and params, or null if no route found or constraints failed.
	 *          Also returns methodMismatch: true if the path exists but the HTTP method doesn't match.
	 */
	lookup(request: Request): { match: RouteWithParams | null; methodMismatch: boolean } {
		const url = new URL(request.url);
		const hostname = url.hostname;

		const result = findRoute(this.#matcher, request.method, url.pathname, hostname);

		if (!result.match) {
			return { match: null, methodMismatch: result.methodMismatch || false };
		}

		const { route } = result.match.data;
		const params = result.match.params ?? {};

		if (!this.#checkConstraints(route, params)) {
			// Constraint failure is treated as 404, not 405
			return { match: null, methodMismatch: false };
		}

		return { match: { route, request, url, params }, methodMismatch: false };
	}

	#checkConstraints(route: RouteDefinition, params: Record<string, string>): boolean {
		// Check route-specific constraints (from 'where')
		// These MUST match - 404 if parameter doesn't exist or validation fails
		for (const [param, constraint] of Object.entries(route.constraints ?? {})) {
			if (constraint == null) continue;
			const value = params[param];
			if (value == null) return false;
			if (!matchConstraint(constraint, value)) return false;
		}

		// Check global pattern constraints (from 'parameterPatterns')
		// These only validate if the parameter exists
		for (const [param, constraint] of Object.entries(route.globalConstraints ?? {})) {
			if (constraint == null) continue;
			const value = params[param];
			if (value != null && !matchConstraint(constraint, value)) return false;
		}

		return true;
	}

	/**
	 * Resolve middleware priority from configuration.
	 * If a function is provided, creates a builder and calls it.
	 * If an array is provided, returns it directly.
	 * If nothing is provided, returns the default priority list.
	 */
	#resolveMiddlewarePriority(): MiddlewareReference[] {
		const middlewarePriority = this.#config.middlewarePriority;

		if (!middlewarePriority) {
			return DEFAULT_MIDDLEWARE_PRIORITY;
		}

		if (typeof middlewarePriority === "function") {
			const builder = new MiddlewarePriorityBuilder(DEFAULT_MIDDLEWARE_PRIORITY);
			middlewarePriority(builder);
			return builder.toArray();
		}

		return middlewarePriority;
	}
}

const BUILT_IN_CONSTRAINTS: Record<BuiltInRouteConstraint, RegExp> = {
	numeric: /^\d+$/,
	alphanumeric: /^[a-zA-Z0-9]+$/,
	uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
	ulid: /^[0-9A-Z]{26}$/i,
};

function matchConstraint(constraint: ParamConstraint, value: string): boolean {
	let pattern: RegExp | ((value: string) => boolean);

	if (typeof constraint === "string") {
		pattern = BUILT_IN_CONSTRAINTS[constraint];
		if (!pattern) {
			throw new Error(
				`"${constraint}" is not a valid constraint, use ${Object.keys(BUILT_IN_CONSTRAINTS).join(", ")} or define your own regex or function`,
			);
		}
	} else {
		pattern = constraint;
	}

	if (typeof pattern === "function") {
		return pattern(value);
	}
	return pattern.test(value);
}
