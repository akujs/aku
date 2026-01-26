import { CommandHandler } from "../cli/CommandHandler.ts";
import { CommandRegistry } from "../cli/CommandRegistry.ts";
import type { CliApi } from "../cli/contracts/CliApi.ts";
import { CliApi as CliApiToken } from "../cli/contracts/CliApi.ts";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import type { Container } from "../container/contracts/Container.ts";
import { Database } from "../database/contracts/Database.ts";
import { DatabaseServiceProvider } from "../database/DatabaseServiceProvider.ts";
import { DevelopmentServiceProvider } from "../development/DevelopmentServiceProvider.ts";
import { HttpServiceProvider } from "../http/HttpServiceProvider.ts";
import { RequestHandler } from "../http/RequestHandler.ts";
import { Router } from "../http/Router.ts";
import { RouteUrlGenerator } from "../http/RouteUrlGenerator.ts";
import { IntegrationContext } from "../integrations/IntegrationContext.ts";
import { Storage } from "../storage/contracts/Storage.ts";
import { StorageServiceProvider } from "../storage/StorageServiceProvider.ts";
import { BaseClass } from "../utils.ts";
import { ViewServiceProvider } from "../view/ViewServiceProvider.ts";
import { CoreServiceProvider } from "./CoreServiceProvider.ts";
import type {
	ServiceProviderReference,
	UrlOptionsNoParams,
	UrlOptionsWithParams,
} from "./contracts/Application.ts";
import { Application } from "./contracts/Application.ts";
import { Configuration } from "./contracts/Configuration.ts";
import { Dispatcher } from "./contracts/Dispatcher.ts";
import { AkuError } from "./core-errors.ts";
import type { ServiceProvider } from "./ServiceProvider.ts";

const DEFAULT_PROVIDERS = [
	CoreServiceProvider,
	HttpServiceProvider,
	ViewServiceProvider,
	StorageServiceProvider,
	DatabaseServiceProvider,
	DevelopmentServiceProvider,
];

export class ApplicationImpl<RouteParams extends Record<string, string> = {}>
	extends BaseClass
	implements Application<RouteParams>
{
	readonly container: Container;

	#config: Configuration<RouteParams>;
	#serviceProvidersToBoot: ServiceProvider[] = [];
	#registeredProviders = new Set<ServiceProviderReference>();
	#hasBooted = false;

	constructor(config: Configuration<RouteParams> = {}) {
		super();
		this.container = new ContainerImpl();
		this.#config = config;
		if (config.appUrl?.overrideHost?.includes("/")) {
			throw new Error(
				`Invalid appUrl.overrideHost: "${config.appUrl.overrideHost}". Host must not contain slashes.`,
			);
		}
		if (config.appUrl?.defaultHost?.includes("/")) {
			throw new Error(
				`Invalid appUrl.defaultHost: "${config.appUrl.defaultHost}". Host must not contain slashes.`,
			);
		}
	}

	bootstrap(): void {
		if (this.#hasBooted) return;
		this.container.singletonInstance(Configuration, this.#config);
		this.container.singletonInstance(Application, this);
		this.#registerServiceProviders(DEFAULT_PROVIDERS);
		this.#registerServiceProviders(this.#config.providers ?? []);
		this.#bootServiceProviders();
	}

	get events(): Dispatcher {
		this.#requireBooted("events");
		return this.container.get(Dispatcher);
	}

	get storage(): Storage {
		this.#requireBooted("storage");
		return this.container.get(Storage);
	}

	get database(): Database {
		this.#requireBooted("storage");
		return this.container.get(Database);
	}

	url<N extends keyof RouteParams & string>(
		name: N,
		...args: RouteParams[N] extends never
			? [] | [options?: UrlOptionsNoParams]
			: [options: UrlOptionsWithParams<RouteParams[N]>]
	): string {
		this.#requireBooted(this.url.name);
		return this.container.get(RouteUrlGenerator).url(name, args[0]);
	}

	async handleRequest(request: Request, context: IntegrationContext): Promise<Response> {
		this.#requireBooted(this.handleRequest.name);
		// Enrich context with requestUrl if not already provided
		const enrichedContext: IntegrationContext = {
			...context,
			requestUrl: context.requestUrl ?? new URL(request.url),
		};

		return this.withIntegration(enrichedContext, async () => {
			const router = this.container.get(Router);
			const requestHandler = this.container.get(RequestHandler);

			const { match, methodMismatch } = router.lookup(request);

			if (!match) {
				return methodMismatch
					? new Response("Method Not Allowed", { status: 405 })
					: new Response("Not Found", { status: 404 });
			}

			return requestHandler.handle(match);
		});
	}

	async handleCommand(args: string[], cli: CliApi): Promise<number> {
		this.#requireBooted(this.handleCommand.name);

		return this.container.withScope(async () => {
			this.container.scopedInstance(CliApiToken, cli);
			const commandHandler = this.container.get(CommandHandler);
			return commandHandler.handle(args, cli);
		});
	}

	withIntegration<R>(context: IntegrationContext, callback: () => R): R {
		this.#requireBooted(this.withIntegration.name);
		if (this.container.hasScope) {
			throw new AkuError("Can't start a new request scope, we're already handling a request.");
		}
		return this.container.withScope(() => {
			this.container.scopedInstance(IntegrationContext, context);
			return callback();
		});
	}

	registerServiceProvider(providerClass: ServiceProviderReference): void {
		if (this.#registeredProviders.has(providerClass)) {
			return;
		}
		this.#registeredProviders.add(providerClass);

		const provider = new providerClass(this);
		provider.register();
		this.#serviceProvidersToBoot.push(provider);
		if (this.#hasBooted) {
			this.#bootServiceProviders();
		}
	}

	#registerServiceProviders(providers: ServiceProviderReference[]): void {
		for (const provider of providers) {
			this.registerServiceProvider(provider);
		}
	}

	#bootServiceProviders(): void {
		try {
			const registry = this.container.get(CommandRegistry);
			// Iterate by index to allow providers to register new providers during boot
			for (let i = 0; i < this.#serviceProvidersToBoot.length; i++) {
				const provider = this.#serviceProvidersToBoot[i];
				provider.boot();
				for (const commandClass of provider.commands) {
					registry.register(commandClass);
				}
			}
		} finally {
			this.#hasBooted = true;
			this.#serviceProvidersToBoot.length = 0;
		}
	}

	#requireBooted(method: string): void {
		if (!this.#hasBooted) {
			throw new AkuError(`Application must be bootstrapped before using app.${method}`);
		}
	}
}
