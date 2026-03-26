import { afterEach, describe, expect, test } from "bun:test";
import { RequestLocals } from "../http/contracts/RequestLocals.ts";
import { HttpRequestHandledEvent } from "../http/http-events.ts";
import { mockIntegrationContext } from "../testing/mock-integration-context.ts";
import { ApplicationImpl } from "./ApplicationImpl.ts";
import type { Application, ServiceProviderReference } from "./contracts/Application.ts";
import { Dispatcher } from "./contracts/Dispatcher.ts";
import { createApplication } from "./createApplication.ts";
import { DispatcherImpl } from "./DispatcherImpl.ts";
import { setFacadeApplication } from "./facade.ts";
import { createKey } from "./Key.ts";
import { ServiceProvider } from "./ServiceProvider.ts";

afterEach(() => {
	setFacadeApplication(null);
});

describe(ApplicationImpl, () => {
	test("events getter uses container resolution", () => {
		const app = new ApplicationImpl();
		app.bootstrap();

		// Bind dispatcher as singleton
		app.container.bind(Dispatcher, {
			factory: (container) => new DispatcherImpl(container),
			lifecycle: "singleton",
		});

		// Access through getter multiple times
		const events1 = app.events;
		const events2 = app.events;

		// Should be same instance (singleton)
		expect(events1).toBe(events2);
		expect(events1).toBeInstanceOf(DispatcherImpl);
	});

	test("handleRequest calls configured handler and returns its response", async () => {
		const app = createApplication({
			handler: () => new Response("hello from handler"),
		});

		const response = await app.handleRequest(
			new Request("http://example.com/test"),
			mockIntegrationContext(),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("hello from handler");
	});

	test("handleRequest passes request to handler", async () => {
		const app = createApplication({
			handler: (request) => new Response(`method: ${request.method}, url: ${request.url}`),
		});

		const response = await app.handleRequest(
			new Request("http://example.com/path", { method: "POST" }),
			mockIntegrationContext(),
		);

		expect(await response.text()).toBe("method: POST, url: http://example.com/path");
	});

	test("RequestLocals accessible within handler", async () => {
		const testKey = createKey<string>({ displayName: "testKey" });

		const app = createApplication({
			handler: () => {
				const locals = app.container.get(RequestLocals);
				locals.set(testKey, "stored-value");
				return new Response(locals.get(testKey));
			},
		});

		const response = await app.handleRequest(
			new Request("http://example.com/test"),
			mockIntegrationContext(),
		);

		expect(await response.text()).toBe("stored-value");
	});

	test("HttpRequestHandledEvent fires after handler returns", async () => {
		let firedEvent: HttpRequestHandledEvent | undefined;

		const app = createApplication({
			handler: () => new Response("event-test", { status: 201 }),
		});

		app.events.addListener(HttpRequestHandledEvent, (event) => {
			firedEvent = event;
		});

		const request = new Request("http://example.com/test");
		await app.handleRequest(request, mockIntegrationContext());

		expect(firedEvent).toBeInstanceOf(HttpRequestHandledEvent);
		expect(firedEvent!.request).toBe(request);
		expect(firedEvent!.status).toBe(201);
	});

	test("returns 404 when no handler is configured", async () => {
		const app = createApplication({});

		const response = await app.handleRequest(
			new Request("http://example.com/test"),
			mockIntegrationContext(),
		);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Not Found");
	});

	test("handler errors propagate to caller", async () => {
		const app = createApplication({
			handler: () => {
				throw new Error("handler boom");
			},
		});

		expect(
			app.handleRequest(new Request("http://example.com/test"), mockIntegrationContext()),
		).rejects.toThrow("handler boom");
	});

	test("async handler works", async () => {
		const app = createApplication({
			handler: async () => {
				await Promise.resolve();
				return new Response("async hello");
			},
		});

		const response = await app.handleRequest(
			new Request("http://example.com/test"),
			mockIntegrationContext(),
		);

		expect(await response.text()).toBe("async hello");
	});

	describe("service providers", () => {
		test("provider is only registered once even if called multiple times", () => {
			const app = new ApplicationImpl();
			const calls: string[] = [];
			const Provider = mockServiceProvider("test", calls);

			app.registerServiceProvider(Provider);
			app.registerServiceProvider(Provider);
			app.registerServiceProvider(Provider);
			app.bootstrap();

			expect(calls).toEqual(["register:test", "boot:test"]);
		});

		test("calls register() immediately when provider is registered", () => {
			const app = new ApplicationImpl();
			const calls: string[] = [];
			const Provider = mockServiceProvider("test", calls);

			app.registerServiceProvider(Provider);

			expect(calls).toEqual(["register:test"]);
		});

		test("calls boot() during bootstrap after all providers registered", () => {
			const app = new ApplicationImpl();
			const calls: string[] = [];
			const Provider = mockServiceProvider("test", calls);

			app.registerServiceProvider(Provider);
			expect(calls).toEqual(["register:test"]);

			app.bootstrap();
			expect(calls).toEqual(["register:test", "boot:test"]);
		});

		test("calls all register() methods before any boot() methods", () => {
			const app = new ApplicationImpl();
			const calls: string[] = [];

			const ProviderA = mockServiceProvider("A", calls);
			const ProviderB = mockServiceProvider("B", calls);
			const ProviderC = mockServiceProvider("C", calls);

			app.registerServiceProvider(ProviderA);
			app.registerServiceProvider(ProviderB);
			app.registerServiceProvider(ProviderC);
			app.bootstrap();

			expect(calls).toEqual([
				"register:A",
				"register:B",
				"register:C",
				"boot:A",
				"boot:B",
				"boot:C",
			]);
		});

		test("boots providers in registration order", () => {
			const app = new ApplicationImpl();
			const calls: string[] = [];

			const ProviderA = mockServiceProvider("A", calls);
			const ProviderB = mockServiceProvider("B", calls);
			const ProviderC = mockServiceProvider("C", calls);

			app.registerServiceProvider(ProviderA);
			app.registerServiceProvider(ProviderB);
			app.registerServiceProvider(ProviderC);
			app.bootstrap();

			const bootOrder = calls.filter((c) => c.startsWith("boot:"));
			expect(bootOrder).toEqual(["boot:A", "boot:B", "boot:C"]);
		});

		test("provider receives app reference in constructor", () => {
			const app = new ApplicationImpl();
			let receivedApp: Application | undefined;

			class TestProvider extends ServiceProvider {
				override register(): void {
					receivedApp = this.app;
				}
			}

			app.registerServiceProvider(TestProvider);

			expect(receivedApp).toBe(app);
		});

		test("provider can access container via this.container", () => {
			const app = new ApplicationImpl();
			let accessedContainer = false;

			class TestProvider extends ServiceProvider {
				override register(): void {
					expect(this.container).toBe(app.container);
					accessedContainer = true;
				}
			}

			app.registerServiceProvider(TestProvider);

			expect(accessedContainer).toBe(true);
		});

		test("provider registered during boot is registered and booted in same cycle", () => {
			const app = new ApplicationImpl();
			const calls: string[] = [];

			const SecondProvider = mockServiceProvider("second", calls);

			class FirstProvider extends ServiceProvider {
				override register(): void {
					calls.push("register:first");
				}

				override boot(): void {
					calls.push("boot:first");
					app.registerServiceProvider(SecondProvider);
				}
			}

			app.registerServiceProvider(FirstProvider);
			app.bootstrap();

			expect(calls).toEqual(["register:first", "boot:first", "register:second", "boot:second"]);
		});

		test("provider registered after bootstrap completes is registered and booted immediately", () => {
			const app = new ApplicationImpl();
			const calls: string[] = [];

			app.bootstrap();

			const Provider = mockServiceProvider("late", calls);
			app.registerServiceProvider(Provider);

			expect(calls).toEqual(["register:late", "boot:late"]);
		});

		test("error in provider.register() prevents bootstrap", () => {
			const app = new ApplicationImpl();

			class FailingProvider extends ServiceProvider {
				override register(): void {
					throw new Error("register failed");
				}
			}

			expect(() => {
				app.registerServiceProvider(FailingProvider);
			}).toThrow("register failed");
		});

		test("error in provider.boot() prevents bootstrap", () => {
			const app = new ApplicationImpl();

			class FailingProvider extends ServiceProvider {
				override boot(): void {
					throw new Error("boot failed");
				}
			}

			app.registerServiceProvider(FailingProvider);

			expect(() => {
				app.bootstrap();
			}).toThrow("boot failed");
		});

		test("DEFAULT_PROVIDERS are registered during bootstrap", () => {
			const app = new ApplicationImpl();
			app.bootstrap();

			// Verify core providers are available (test a few from different providers)
			expect(() => app.container.get(Dispatcher)).not.toThrow();
			expect(() => app.events).not.toThrow();
			expect(() => app.storage).not.toThrow();
		});
	});
});

const mockServiceProvider = (name: string, calls: string[]): ServiceProviderReference =>
	class extends ServiceProvider {
		static override get name(): string {
			return name;
		}
		override register(): void {
			calls.push(`register:${name}`);
		}

		override boot(): void {
			calls.push(`boot:${name}`);
		}
	};
