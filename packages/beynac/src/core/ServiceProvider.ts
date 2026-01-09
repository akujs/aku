import type { Container } from "../container/contracts/Container.ts";
import { BaseClass } from "../utils.ts";
import type { Application } from "./contracts/Application.ts";

/**
 * Base class for service providers.
 */
export abstract class ServiceProvider extends BaseClass {
	protected app: Application;

	constructor(app: Application) {
		super();
		this.app = app;
	}

	/**
	 * Register services in the container.
	 *
	 * This method is called first and may only register services in the
	 * container e.g. with `this.container.singleton(...)`
	 */
	register(): void {}

	/**
	 * Bootstrap services.
	 *
	 * This is called after all service providers have been registered. If you
	 * need to interact with the framework, do so in this method.
	 */
	boot(): void {}

	/**
	 * Shorthand for accessing the service container
	 */
	protected get container(): Container {
		return this.app.container;
	}
}
