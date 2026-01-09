import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { Container } from "../../container/contracts/Container.ts";
import type { Database } from "../../database/contracts/Database.ts";
import type { IntegrationContext } from "../../integrations/IntegrationContext.ts";
import type { Storage } from "../../storage/contracts/Storage.ts";
import type { ServiceProvider } from "../ServiceProvider.ts";
import type { Dispatcher } from "./Dispatcher.ts";

export type QueryParams =
	| Record<string, string | number | undefined | null | Array<string | number | undefined | null>>
	| URLSearchParams;

export type UrlOptionsWithParams<T extends string> = {
	params: Record<T, string | number>;
	query?: QueryParams | undefined;
};

export type UrlOptionsNoParams = {
	params?: Record<never, never> | undefined;
	query?: QueryParams | undefined;
};

/**
 * Application contract for handling HTTP requests
 */
export interface Application<RouteParams extends Record<string, string> = {}> {
	/**
	 * Public container for dependency injection
	 */
	container: Container;

	/**
	 * Handle an incoming HTTP request. The request will be routed to the
	 * appropriate handler and will go through the middleware pipeline.
	 */
	handleRequest(request: Request, context: IntegrationContext): Promise<Response>;

	/**
	 * Execute a callback in a context where request data is available.
	 *
	 * This enables Beynac features that require request data, like the `Cookies`
	 * and `Headers` facades, and higher-level features like authentication that
	 * require access to headers and cookies.
	 */
	withIntegration<R>(context: IntegrationContext, callback: () => R): R;

	/**
	 * Register a service provider.
	 *
	 * The service provider's register() method will be called immediately. If
	 * the application has finished starting, the provider's boot() method will
	 * be called as well, otherwise it will be called after the boot methods of
	 * service providers registered earlier.
	 */
	registerServiceProvider(provider: ServiceProvider | ServiceProviderReference): void;

	/**
	 * Shorthand for container.get(Dispatcher)
	 */
	readonly events: Dispatcher;

	/**
	 * Shorthand for container.get(Storage)
	 */
	readonly storage: Storage;

	/**
	 * Shorthand for container.get(Database)
	 */
	readonly database: Database;

	/**
	 * Generate a URL for a named route with type-safe parameters and optional query string
	 */
	url<N extends keyof RouteParams & string>(
		name: N,
		...args: RouteParams[N] extends never
			? [] | [options?: UrlOptionsNoParams]
			: [options: UrlOptionsWithParams<RouteParams[N]>]
	): string;
}

export const Application: TypeToken<Application> = createTypeToken("Application");

export type ServiceProviderReference = new (app: Application) => ServiceProvider;
