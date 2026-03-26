import type { Container } from "../container/contracts/Container.ts";
import type { Application } from "../core/contracts/Application.ts";
import type { Configuration } from "../core/contracts/Configuration.ts";
import { createApplication } from "../core/createApplication.ts";
import { type CliTestHarness, createCliTestHarness } from "./cli-test-harness.ts";
import { mockIntegrationContext } from "./mock-integration-context.ts";

/**
 * A test harness for an Aku application, providing access to the application
 * instance, its container, and helpers for making HTTP requests and
 * running CLI commands.
 */
export interface TestApplication {
	/** The application instance. */
	app: Application;
	/** The application's dependency injection container. */
	container: Container;
	/**
	 * Send an HTTP request through the application's handler.
	 * Accepts a URL string, `URL` object, or `Request` object. String URLs starting with `/` are
	 * prefixed with `https://example.com`; strings starting with `//` are prefixed with `https:`.
	 */
	request: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
	/** A test harness for running CLI commands and inspecting their output. */
	cli: CliTestHarness;
}

/**
 * Create an application instance configured for testing, with helpers for
 * sending HTTP requests and running CLI commands.
 */
export const createTestApplication = (config: Configuration = {}): TestApplication => {
	const app = createApplication({
		...config,
		devMode: { autoRefresh: false, ...config.devMode },
	});

	const container = app.container;

	const request = async (input: string | URL | Request, init?: RequestInit) => {
		let req: Request;
		if (typeof input === "string") {
			let url = input;
			if (url.startsWith("//")) {
				url = "https:" + url;
			} else if (url.startsWith("/")) {
				url = "https://example.com" + url;
			}
			req = new Request(url, init);
		} else if (input instanceof URL) {
			req = new Request(input.href, init);
		} else {
			req = new Request(input, init);
		}
		return await app.handleRequest(req, mockIntegrationContext());
	};

	const cli = createCliTestHarness(app);

	return { app, container, request, cli };
};
