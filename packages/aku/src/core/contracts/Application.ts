import type { CliApi } from "../../cli/contracts/CliApi.ts";
import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { Container } from "../../container/contracts/Container.ts";
import type { Database } from "../../database/contracts/Database.ts";
import type { IntegrationContext } from "../../integrations/IntegrationContext.ts";
import type { Storage } from "../../storage/contracts/Storage.ts";
import type { ServiceProvider } from "../ServiceProvider.ts";
import type { Dispatcher } from "./Dispatcher.ts";

/**
 * Application contract for handling HTTP requests
 */
export interface Application {
	/**
	 * Public container for dependency injection
	 */
	container: Container;

	/**
	 * Handle an incoming HTTP request. The configured handler is called within
	 * a DI scope, so scoped services like `Cookies`, `Headers`, and
	 * `RequestLocals` are available.
	 */
	handleRequest(request: Request, context: IntegrationContext): Promise<Response>;

	/**
	 * Handle a CLI command and return the exit code. The command will be
	 * looked up in the registry and executed.
	 *
	 * @param args Command-line arguments, e.g. ["db:test", "--connection=default"]
	 * @param cli - CLI API for user interaction
	 */
	handleCommand(args: string[], cli: CliApi): Promise<number>;

	/**
	 * Execute a callback in a context where request data is available.
	 *
	 * This enables Aku features that require request data, like the `Cookies`
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
}

export const Application: TypeToken<Application> = createTypeToken("Application");

export type ServiceProviderReference = new (app: Application) => ServiceProvider;
