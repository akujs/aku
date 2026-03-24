import { Container } from "../container/contracts/Container.ts";
import { inject } from "../container/inject.ts";
import type { QueryParams } from "../core/contracts/Application.ts";
import { Configuration } from "../core/contracts/Configuration.ts";
import { IntegrationContext } from "../integrations/IntegrationContext.ts";
import { arrayWrapOptional, BaseClass } from "../utils.ts";
import type { Headers } from "./contracts/Headers.ts";
import { HeadersImpl } from "./HeadersImpl.ts";
import { type RouteDefinition, type Routes } from "./router-types.ts";
import { replaceRouteParams } from "./syntax.ts";

export class RouteUrlGenerator extends BaseClass {
	#namedRoutes = new Map<string, RouteDefinition>();
	#container: Container;
	#config: Configuration;

	constructor(
		container: Container = inject(Container),
		config: Configuration = inject(Configuration),
	) {
		super();
		this.#container = container;
		this.#config = config;
	}

	register(routes: Routes): void {
		for (const route of routes) {
			if (route.routeName) {
				this.#namedRoutes.set(route.routeName, route);
			}
		}
	}

	url(
		name: string,
		options?: {
			params?: Record<string, string | number> | undefined;
			query?: QueryParams | undefined;
		},
	): string {
		const route = this.#namedRoutes.get(name);
		if (!route) {
			throw new Error(`Route "${name}" not found`);
		}

		const routeParams = options?.params ?? {};
		const path = replaceRouteParams(route.path, routeParams);

		const appUrl = this.#config.appUrl;
		const integrationContext = this.#container.getIfAvailable(IntegrationContext);
		const requestUrl = integrationContext?.requestUrl;
		const headers = integrationContext ? new HeadersImpl(integrationContext) : null;

		// Resolve protocol
		let protocol: string | null = null;
		if (appUrl?.overrideProtocol) {
			protocol = `${appUrl.overrideProtocol}:`;
		}
		if (!protocol && headers) {
			protocol = getProtocolFromHeaders(headers);
		}
		if (!protocol && appUrl?.defaultProtocol) {
			protocol = `${appUrl.defaultProtocol}:`;
		}
		if (!protocol && requestUrl) {
			protocol = requestUrl.protocol;
		}

		// Resolve host
		let host: string | null = null;
		if (route.domainPattern) {
			host = replaceRouteParams(route.domainPattern, routeParams);
		}
		if (!host && appUrl?.overrideHost) {
			host = appUrl.overrideHost;
		}
		if (!host && headers) {
			host = getHostFromHeaders(headers);
		}
		if (!host && appUrl?.defaultHost) {
			host = appUrl.defaultHost;
		}
		if (!host && requestUrl) {
			host = requestUrl.host;
		}

		// Strip default ports before building URL
		if (host && protocol) {
			if (protocol === "http:" && host.endsWith(":80")) {
				host = host.slice(0, -3);
			} else if (protocol === "https:" && host.endsWith(":443")) {
				host = host.slice(0, -4);
			}
		}

		const baseUrl = host ? `${protocol ?? ""}//${host}${path}` : path;

		const queryString = this.#buildQueryString(options?.query);
		return queryString ? `${baseUrl}?${queryString}` : baseUrl;
	}

	#buildQueryString(query: QueryParams | undefined): string {
		if (!query) return "";

		if (query instanceof URLSearchParams) {
			return query.toString();
		}

		const params = new URLSearchParams();
		for (const [key, values] of Object.entries(query)) {
			for (const value of arrayWrapOptional(values)) {
				if (value != null) {
					params.append(key, String(value));
				}
			}
		}

		return params.toString();
	}
}

const firstHeaderValue = (headers: Headers, name: string): string | null =>
	headers.get(name)?.split(",")[0]?.trim() ?? null;

function getProtocolFromHeaders(headers: Headers): string | null {
	const forwardedProto =
		firstHeaderValue(headers, "x-forwarded-proto") ??
		firstHeaderValue(headers, "x-forwarded-protocol") ??
		firstHeaderValue(headers, "x-url-scheme");
	if (forwardedProto) {
		return forwardedProto.includes(":") ? forwardedProto : `${forwardedProto}:`;
	}

	const frontEndHttps =
		firstHeaderValue(headers, "front-end-https") ?? firstHeaderValue(headers, "x-forwarded-ssl");
	if (frontEndHttps === "on") {
		return "https:";
	}

	return null;
}

function getHostFromHeaders(headers: Headers): string | null {
	const host = firstHeaderValue(headers, "x-forwarded-host") ?? firstHeaderValue(headers, "host");

	return host;
}
