import { arrayWrapOptional } from "../utils.ts";
import type { Controller, ConvertsToResponse } from "./Controller.ts";
import { MiddlewareSet } from "./MiddlewareSet.ts";
import type { ApiResourceAction, ResourceAction } from "./ResourceController.ts";
import type { RedirectOptions } from "./redirect.ts";
import { redirectStatus } from "./redirect.ts";
import type {
	ExtractDomainAndPathParams,
	FilteredApiResourceRouteMap,
	FilteredResourceRouteMap,
	GroupChildren,
	GroupedRoutes,
	InferResourceName,
	ParamConstraint,
	RouteDefinition,
	RouteGroupOptions,
	RouteOptions,
	Routes,
	StatusPages,
} from "./router-types.ts";
import {
	validateDomainSyntax,
	validateGroupPathSyntax,
	validateRoutePathSyntax,
} from "./syntax.ts";

/**
 * Create a constraint that matches one of the given values
 *
 * @example
 * get('/status/{type}', controller, {
 *   where: { type: isIn(['active', 'inactive', 'pending']) }
 * })
 */
export function isIn(values: readonly string[]): ParamConstraint {
	const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`^(${values.map(escapeRegex).join("|")})$`);
}

function validateStatusPages(statusPages: StatusPages | undefined) {
	if (!statusPages) return;

	for (const [key, component] of Object.entries(statusPages)) {
		if (!component) continue;

		if (key === "4xx" || key === "5xx") continue;

		if (/^[45]\d\d$/.test(key)) continue;

		throw new Error(
			`Invalid status identifier "${key}" in statusPages. Must be a number (400-599), "4xx", or "5xx".`,
		);
	}
}

function mergeObjects<T extends Record<string | number, unknown>>(
	parent: T | null | undefined,
	child: T | null,
): T | null {
	if (!parent) return child;
	if (!child) return parent;
	return { ...parent, ...child };
}

function createRoute<
	const Path extends string,
	const Name extends string = never,
	const Domain extends string | undefined = undefined,
>(
	method: string | readonly string[],
	path: Path,
	controller: Controller,
	{
		domain,
		parameterPatterns,
		middleware: middlewareOption,
		name,
		where,
		withoutMiddleware,
		meta,
		statusPages,
	}: RouteOptions<Name, Path> & { domain?: Domain } = {},
): RouteMethodReturn<Path, Name, Domain> {
	const methods = typeof method === "string" ? [method] : method;

	// Validate: path must start with "/" or be empty string
	if (!path.startsWith("/")) {
		throw new Error(`Route path "${path}" must start with "/"`);
	}

	validateRoutePathSyntax(path);
	validateDomainSyntax(domain);

	validateStatusPages(statusPages);

	const route: RouteDefinition = {
		methods,
		path,
		controller,
		routeName: name,
		middleware: MiddlewareSet.createIfRequired(middlewareOption, withoutMiddleware),
		constraints: where ?? null,
		globalConstraints: parameterPatterns ?? null,
		domainPattern: domain,
		meta: meta ?? null,
		statusPages: statusPages ?? null,
	};

	return [route] as RouteMethodReturn<Path, Name, Domain>;
}

type RouteMethodFunction = <
	const Path extends string,
	const Name extends string = never,
	const Domain extends string | undefined = undefined,
>(
	path: Path,
	controller: Controller,
	options?: RouteOptions<Name, Path> & { domain?: Domain },
) => RouteMethodReturn<Path, Name, Domain>;

type RouteMethodReturn<
	Path extends string,
	Name extends string = never,
	Domain extends string | undefined = undefined,
> = [Name] extends [never]
	? Routes<{}>
	: Routes<{ [K in Name]: ExtractDomainAndPathParams<Domain, Path> }>;

/**
 * Register a route that responds to GET requests
 *
 * @example
 * get('/users', UsersController)
 * get('/users/{id}', UserController, { name: 'users.show' })
 */
export const get: RouteMethodFunction = (path, controller, options) =>
	createRoute("GET", path, controller, options);

/**
 * Register a route that responds to POST requests
 *
 * @example
 * post('/users', CreateUserController)
 */
export const post: RouteMethodFunction = (path, controller, options) =>
	createRoute("POST", path, controller, options);

/**
 * Register a route that responds to PUT requests
 *
 * @example
 * put('/users/{id}', UpdateUserController)
 */
export const put: RouteMethodFunction = (path, controller, options) =>
	createRoute("PUT", path, controller, options);

/**
 * Register a route that responds to PATCH requests
 *
 * @example
 * patch('/users/{id}', PatchUserController)
 */
export const patch: RouteMethodFunction = (path, controller, options) =>
	createRoute("PATCH", path, controller, options);

/**
 * Register a route that responds to DELETE requests
 *
 * @example
 * delete('/users/{id}', DeleteUserController)
 */
export const delete_: RouteMethodFunction = (path, controller, options) =>
	createRoute("DELETE", path, controller, options);

/***/
export { delete_ as delete };

/**
 * Register a route that responds to OPTIONS requests
 *
 * @example
 * options('/users', OptionsController)
 */
export const options: RouteMethodFunction = (path, controller, options) =>
	createRoute("OPTIONS", path, controller, options);

/**
 * Register a route that responds to specific HTTP methods
 *
 * @example
 * match(['GET', 'POST'], '/contact', ContactController)
 */
export function match<
	const Path extends string,
	const Name extends string = never,
	const Domain extends string | undefined = undefined,
>(
	methods: readonly string[],
	path: Path,
	controller: Controller,
	options?: RouteOptions<Name, Path> & { domain?: Domain },
): RouteMethodReturn<Path, Name, Domain> {
	return createRoute(methods, path, controller, options);
}

/**
 * Register a route that responds to any HTTP method
 *
 * @example
 * any('/webhook', WebhookController)
 */
export function any<
	const Path extends string,
	const Name extends string = never,
	const Domain extends string | undefined = undefined,
>(
	path: Path,
	controller: Controller,
	options?: RouteOptions<Name, Path> & { domain?: Domain },
): RouteMethodReturn<Path, Name, Domain> {
	const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
	return match(methods, path, controller, options);
}

/**
 * Respond with an HTTP redirect. The result of this function can either be used
 * as a controller or returned from a controller or middleware.
 *
 * @param to - The URL to redirect to
 * @param options.permanent - If true, Make a permanent redirect that instructs
 *        search engines to update their index to the new URL (default: false)
 * @param options.preserveHttpMethod - If true, preserves HTTP method so POST
 *        requests will result in a POST request to the new URL (default: false)
 *
 * Status codes used:
 * - 303 Temporary redirect, changes to GET method
 * - 307 Temporary redirect, preserves method
 * - 301 Permanent redirect, changes to GET
 * - 308 Permanent redirect, preserves method
 *
 * @example
 * // Use as a controller:
 * get('/old', redirect('/new'));
 *
 * // Use as a return value from a controller or middleware:
 * get('/old', async (ctx) => {
 *   return redirect(theNewUrl);
 * })
 */
export function redirect(to: string, options?: RedirectOptions): Controller & ConvertsToResponse {
	const status = redirectStatus(options);

	const createResponse = () =>
		new Response(null, {
			status,
			headers: { Location: to },
		});

	return Object.assign(createResponse, { toResponse: createResponse });
}

/**
 * Define a group of routes without any shared options
 *
 * @example
 * // Grouping routes together
 * group([
 *   get('/dashboard', DashboardController),
 *   get('/users', UsersController),
 * ])
 */
export function group<const Children extends GroupChildren>(
	children: Children,
): GroupedRoutes<Children>;

/**
 * Define a group of routes with shared options
 *
 * @example
 * // Apply a prefix and middleware to a group of routes
 * group({ prefix: '/admin', middleware: AuthMiddleware }, [
 *   get('/dashboard', DashboardController),
 *   get('/users', UsersController),
 * ])
 */
export function group<
	const Children extends GroupChildren,
	const NamePrefix extends string = "",
	const PathPrefix extends string = "",
>(
	options: RouteGroupOptions<NamePrefix, PathPrefix>,
	children: Children,
): GroupedRoutes<Children, NamePrefix, PathPrefix>;

/***/
export function group<
	const Children extends GroupChildren,
	const NamePrefix extends string = "",
	const PathPrefix extends string = "",
>(
	optionsOrChildren: RouteGroupOptions<NamePrefix, PathPrefix> | Children,
	maybeChildren?: Children,
): GroupedRoutes<Children, NamePrefix, PathPrefix> {
	if (Array.isArray(optionsOrChildren)) {
		return group({}, optionsOrChildren as Children);
	}

	let {
		domain,
		parameterPatterns,
		middleware,
		withoutMiddleware,
		namePrefix,
		prefix,
		where,
		meta,
		statusPages,
	} = optionsOrChildren as RouteGroupOptions<string, string>;
	const children = maybeChildren as Children;

	validateGroupPathSyntax(prefix);
	validateDomainSyntax(domain);

	// strip "/" suffix from the prefix to prevent double slash since all routes start with a slash
	prefix = prefix?.replace(/\/$/, "");

	const groupWithout = arrayWrapOptional(withoutMiddleware);
	const groupMiddleware = arrayWrapOptional(middleware).filter((m) => !groupWithout.includes(m));

	const mergedChildren: RouteDefinition[] = [];
	const mergedSets = new Set<MiddlewareSet>();

	const groupMiddlewareSet = MiddlewareSet.createIfRequired(middleware, withoutMiddleware);
	validateStatusPages(statusPages);

	for (const childRoutes of children) {
		for (const route of childRoutes) {
			if (domain && route.domainPattern && domain !== route.domainPattern) {
				throw new Error(
					`Domain conflict: route "${route.routeName || route.path}" specifies domain "${route.domainPattern}" ` +
						`but is inside a group with domain "${domain}". Nested routes cannot override parent domain.`,
				);
			}

			// Middleware merging logic
			let middleware = route.middleware;
			if (middleware) {
				// merge the groups's middleware into the route, and only do this once
				// per middleware object because they can be shared among many routes
				if (!mergedSets.has(middleware)) {
					middleware.mergeWithGroup(groupMiddleware, groupWithout);
					mergedSets.add(middleware);
				}
			} else {
				// all routes with no middleware can share the groups' middleware
				middleware = groupMiddlewareSet;
			}

			mergedChildren.push({
				...route,
				path: applyPathPrefix(prefix, route.path),
				routeName: applyNamePrefix(namePrefix, route.routeName),
				middleware,
				constraints: mergeObjects(where, route.constraints),
				globalConstraints: mergeObjects(parameterPatterns, route.globalConstraints),
				domainPattern: domain ?? route.domainPattern,
				meta: mergeObjects(meta, route.meta),
				statusPages: mergeObjects(statusPages, route.statusPages),
			});
		}
	}
	return mergedChildren;
}

function applyPathPrefix(prefix: string | undefined, path: string): string {
	if (!prefix) return path;
	const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
	return path === "/" ? normalizedPrefix : `${normalizedPrefix}${path}`;
}

function applyNamePrefix(prefix: string | undefined, name: string | undefined): string | undefined {
	if (!prefix || !name) return name;
	return `${prefix}${name}`;
}

/**
 * Options for resource route registration
 */
export interface ResourceOptions<
	ResourceName extends string,
	Path extends string,
	Only extends readonly ResourceAction[] | undefined = undefined,
	Except extends readonly ResourceAction[] | undefined = undefined,
> extends Omit<RouteOptions<never, Path>, "name"> {
	/**
	 * Override the base name for route naming. If not provided, derived from path.
	 * @example
	 * resource('/photos', PhotoController, { name: 'pics' })
	 * // Creates routes: pics.index, pics.show, etc.
	 */
	name?: ResourceName;

	/**
	 * Only register these specific actions
	 * @example
	 * resource('/photos', PhotoController, { only: ['index', 'show'] })
	 */
	only?: Only;

	/**
	 * Register all actions except these
	 * @example
	 * resource('/photos', PhotoController, { except: ['destroy'] })
	 */
	except?: Except;
}

/**
 * Register resource routes.
 *
 * This is designed to be used with classes extending ResourceController, which
 * will route each action to a corresponding method.
 *
 * Creates routes for API-focused resource actions:
 * - GET /resource -> index
 * - POST /resource/create -> create
 * - POST /resource -> store
 * - GET /resource/{resourceId} -> show
 * - GET /resource/{resourceId}/edit -> edit
 * - PUT/PATCH /resource/{resourceId} -> update
 * - DELETE /resource/{resourceId} -> destroy
 *
 * The default names of the route is derived from the path by removing the
 * leading slash and replacing all slashes with dots, so if the path if /photos
 * then the index route will be called "photos.index".
 *
 * @param path - The resource path (e.g., '/api/photos')
 * @param controller - A ResourceController subclass
 * @param options - Options for filtering and configuring routes
 *
 * @example
 * apiResource('/api/photos', PhotoApiController)
 * // generating URLs later:
 * app.url("api.photos.show", { resourceId: "123" }); // returns "/api/photos/123"
 */
export function resource<
	const Path extends string,
	const ResourceName extends string = InferResourceName<Path>,
	const Only extends readonly ResourceAction[] | undefined = undefined,
	const Except extends readonly ResourceAction[] | undefined = undefined,
>(
	path: Path,
	controller: Controller,
	options?: ResourceOptions<ResourceName, Path, Only, Except>,
): Routes<FilteredResourceRouteMap<ResourceName, Only, Except>> {
	const { name: customName, only, except, ...routeOptions } = options ?? {};

	// Derive resource name from path: '/photos' -> 'photos', '/admin/photos' -> 'admin.photos'
	const resourceName = (customName ?? path.replace(/^\//, "").replace(/\//g, ".")) as ResourceName;

	// Define all 7 actions with their HTTP methods and paths
	interface ActionDefinition {
		action: ResourceAction;
		method: string | readonly string[];
		path: string;
	}

	const allActions: ActionDefinition[] = [
		{ action: "index", method: "GET", path },
		{ action: "create", method: "GET", path: `${path}/create` },
		{ action: "store", method: "POST", path },
		{ action: "show", method: "GET", path: `${path}/{resourceId}` },
		{ action: "edit", method: "GET", path: `${path}/{resourceId}/edit` },
		{
			action: "update",
			method: ["PUT", "PATCH"],
			path: `${path}/{resourceId}`,
		},
		{ action: "destroy", method: "DELETE", path: `${path}/{resourceId}` },
	];

	const actions = filterResourceActions(allActions, only, except);

	// Create routes for each action - collect as Routes<> for group()
	const routesList: Routes<Record<string, string>>[] = actions.map(
		({ action, method, path: routePath }) => {
			const routeName = `${resourceName}.${action}` as const;
			return createRoute(method, routePath as Path, controller, {
				...routeOptions,
				name: routeName,
				meta: { ...routeOptions.meta, action },
			});
		},
	);

	return group(routesList) as Routes<FilteredResourceRouteMap<ResourceName, Only, Except>>;
}

/**
 * Register API resource routes. Similar to resource(), but excludes create and
 * edit actions that are useful for UIs but tend to be absent in APIs.
 *
 * This is designed to be used with classes extending ResourceController, which
 * will route each action to a corresponding method.
 *
 * Creates routes for API-focused resource actions:
 * - GET /resource -> index
 * - POST /resource -> store
 * - GET /resource/{resourceId} -> show
 * - PUT/PATCH /resource/{resourceId} -> update
 * - DELETE /resource/{resourceId} -> destroy
 *
 * The default names of the route is derived from the path by removing the
 * leading slash and replacing all slashes with dots, so if the path if /photos
 * then the index route will be called "photos.index".
 *
 * @param path - The resource path (e.g., '/api/photos')
 * @param controller - A ResourceController subclass
 * @param options - Options for filtering and configuring routes
 *
 * @example
 * apiResource('/api/photos', PhotoApiController)
 * // generating URLs later:
 * app.url("api.photos.show", { resourceId: "123" }); // returns "/api/photos/123"
 */
export function apiResource<
	const Path extends string,
	const ResourceName extends string = InferResourceName<Path>,
	const Only extends readonly ApiResourceAction[] | undefined = undefined,
	const Except extends readonly ApiResourceAction[] | undefined = undefined,
>(
	path: Path,
	controller: Controller,
	options?: ResourceOptions<ResourceName, Path, Only, Except>,
): Routes<FilteredApiResourceRouteMap<ResourceName, Only, Except>> {
	const apiActions: readonly ApiResourceAction[] = ["index", "store", "show", "update", "destroy"];

	const result = resource(path, controller, {
		...options,
		only: options?.only ?? apiActions,
	});
	return result as unknown as Routes<FilteredApiResourceRouteMap<ResourceName, Only, Except>>;
}

function filterResourceActions<T extends { action: ResourceAction }>(
	actions: readonly T[],
	only?: readonly ResourceAction[],
	except?: readonly ResourceAction[],
): T[] {
	let filtered = [...actions];

	if (only) {
		// If only is specified, start with only those actions
		const onlySet = new Set(only);
		filtered = filtered.filter((a) => onlySet.has(a.action));
	}

	if (except) {
		// Remove actions in except list
		const exceptSet = new Set(except);
		filtered = filtered.filter((a) => !exceptSet.has(a.action));
	}

	return filtered;
}
