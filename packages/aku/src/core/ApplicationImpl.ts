import { CommandHandler } from "../cli/CommandHandler.ts";
import { CommandRegistry } from "../cli/CommandRegistry.ts";
import type { CliApi } from "../cli/contracts/CliApi.ts";
import { CliApi as CliApiToken } from "../cli/contracts/CliApi.ts";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import type { Container } from "../container/contracts/Container.ts";
import { Database } from "../database/contracts/Database.ts";
import { DatabaseServiceProvider } from "../database/DatabaseServiceProvider.ts";
import { DevelopmentServiceProvider } from "../development/DevelopmentServiceProvider.ts";
import { DevModeAutoRefreshMiddleware } from "../development/DevModeAutoRefreshMiddleware.ts";
import { HttpServiceProvider } from "../http/HttpServiceProvider.ts";
import { HttpRequestHandledEvent } from "../http/http-events.ts";
import { IntegrationContext } from "../integrations/IntegrationContext.ts";
import { Storage } from "../storage/contracts/Storage.ts";
import { StorageServiceProvider } from "../storage/StorageServiceProvider.ts";
import { BaseClass } from "../utils.ts";
import { CoreServiceProvider } from "./CoreServiceProvider.ts";
import type { ServiceProviderReference } from "./contracts/Application.ts";
import { Application } from "./contracts/Application.ts";
import { Configuration } from "./contracts/Configuration.ts";
import { Dispatcher } from "./contracts/Dispatcher.ts";
import { AkuError } from "./core-errors.ts";
import type { ServiceProvider } from "./ServiceProvider.ts";

const DEFAULT_PROVIDERS = [
	CoreServiceProvider,
	HttpServiceProvider,
	StorageServiceProvider,
	DatabaseServiceProvider,
	DevelopmentServiceProvider,
];

export class ApplicationImpl extends BaseClass implements Application {
	readonly container: Container;

	#config: Configuration;
	#serviceProvidersToBoot: ServiceProvider[] = [];
	#registeredProviders = new Set<ServiceProviderReference>();
	#hasBooted = false;

	constructor(config: Configuration = {}) {
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
		this.bootstrap();
		return this.container.get(Dispatcher);
	}

	get storage(): Storage {
		this.bootstrap();
		return this.container.get(Storage);
	}

	get database(): Database {
		this.bootstrap();
		return this.container.get(Database);
	}

	async handleRequest(request: Request, context: IntegrationContext): Promise<Response> {
		this.bootstrap();

		return this.withIntegration(context, async () => {
			const autoRefreshEnabled =
				this.#config.development && this.#config.devMode?.autoRefresh !== false;

			if (autoRefreshEnabled) {
				const devMode = this.container.get(DevModeAutoRefreshMiddleware);
				const sseResponse = devMode.handleSseRequest(request);
				if (sseResponse) {
					return sseResponse;
				}
			}

			const handler = this.#config.handler;
			if (!handler) {
				return new Response("Not Found", { status: 404 });
			}

			let response = await handler(request);

			if (autoRefreshEnabled) {
				const devMode = this.container.get(DevModeAutoRefreshMiddleware);
				response = devMode.injectScriptIfHtml(response);
			}

			const dispatcher = this.container.get(Dispatcher);
			dispatcher.dispatch(new HttpRequestHandledEvent(request, response));

			return response;
		});
	}

	async handleCommand(args: string[], cli: CliApi): Promise<number> {
		this.bootstrap();

		return this.container.withScope(async () => {
			this.container.scopedInstance(CliApiToken, cli);
			const commandHandler = this.container.get(CommandHandler);
			return commandHandler.handle(args, cli);
		});
	}

	withIntegration<R>(context: IntegrationContext, callback: () => R): R {
		this.bootstrap();
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
				for (const group of provider.commandGroups) {
					registry.registerGroup(group);
				}
				for (const command of provider.commands) {
					registry.register(command);
				}
			}
		} finally {
			this.#hasBooted = true;
			this.#serviceProvidersToBoot.length = 0;
		}
	}
}
