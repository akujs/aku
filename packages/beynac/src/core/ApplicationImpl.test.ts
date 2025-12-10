import { afterEach, describe, expect, expectTypeOf, test } from "bun:test";
import { Cookies, Headers } from "../facades-entry-point.ts";
import type { ControllerContext } from "../http/Controller.ts";
import { BaseController } from "../http/Controller.ts";
import { get, group } from "../http/helpers.ts";
import type { Routes } from "../http/router-types.ts";
import {
	MockController,
	mockIntegrationContext,
	mockMiddleware,
} from "../test-utils/http-test-utils.bun.ts";
import { ApplicationImpl } from "./ApplicationImpl.ts";
import type { Application, ServiceProviderReference } from "./contracts/Application.ts";
import { Dispatcher } from "./contracts/Dispatcher.ts";
import { createApplication } from "./createApplication.ts";
import { DispatcherImpl } from "./DispatcherImpl.ts";
import { setFacadeApplication } from "./facade.ts";
import { ServiceProvider } from "./ServiceProvider.ts";

afterEach(() => {
	setFacadeApplication(null);
});

describe("ApplicationImpl", () => {
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

	test("url() generates URLs for named routes", () => {
		const routes = group({}, [
			get("/users/{id}", MockController, { name: "users.show" }),
			get("/posts/{postId}/comments/{commentId}", MockController, {
				name: "posts.comments.show",
			}),
		]);

		const app = new ApplicationImpl({ routes });
		app.bootstrap();

		expect(app.url("users.show", { params: { id: 123 } })).toBe("/users/123");
		expect(app.url("posts.comments.show", { params: { postId: 42, commentId: 7 } })).toBe(
			"/posts/42/comments/7",
		);
	});

	test("url() is type-safe with route parameters", () => {
		const routes = group({}, [
			get("/users/{id}", MockController, { name: "users.show" }),
			get("/posts", MockController, { name: "posts.index" }),
		]);

		const app = new ApplicationImpl({ routes });
		app.bootstrap();

		// These should compile (correct usage)
		expect(app.url("users.show", { params: { id: 123 } })).toBe("/users/123");
		expect(app.url("posts.index")).toBe("/posts");

		// Type checking tests - these should cause TypeScript errors
		// but are guarded to not run at runtime
		if (false as boolean) {
			// @ts-expect-error - Missing required parameter
			app.url("users.show");

			// @ts-expect-error - Invalid route name
			app.url("nonexistent.route");

			// @ts-expect-error - Wrong parameter name
			app.url("users.show", { params: { userId: 123 } });
		}
	});

	test("url() with query params", () => {
		const routes = get("/search", MockController, { name: "search" });
		const app = new ApplicationImpl({ routes });
		app.bootstrap();

		// Basic query params
		expect(app.url("search", { query: { q: "test" } })).toBe("/search?q=test");

		// Multiple query value types: string, number, array
		expect(app.url("search", { query: { q: "test", page: 1, tags: ["a", "b"] } })).toBe(
			"/search?q=test&page=1&tags=a&tags=b",
		);

		// null and undefined are omitted
		expect(app.url("search", { query: { q: "test", filter: null, sort: undefined } })).toBe(
			"/search?q=test",
		);

		// URLSearchParams
		const params = new URLSearchParams();
		params.append("q", "test");
		params.append("page", "2");
		expect(app.url("search", { query: params })).toBe("/search?q=test&page=2");

		// All param variations work for no-param routes
		expect(app.url("search", { query: { q: "test" } })).toBe("/search?q=test");
		expect(app.url("search", { params: undefined, query: { q: "test" } })).toBe("/search?q=test");
		expect(app.url("search", { params: {}, query: { q: "test" } })).toBe("/search?q=test");
	});

	test("url() with query params and route params", () => {
		const routes = get("/users/{id}", MockController, { name: "users.show" });
		const app = new ApplicationImpl({ routes });
		app.bootstrap();

		expect(app.url("users.show", { params: { id: 123 }, query: { tab: "profile" } })).toBe(
			"/users/123?tab=profile",
		);

		// @ts-expect-error
		app.url("users.show", { params: { incorrect: 123 }, query: { tab: "profile" } });
	});

	test("handles HTTP request through RouterV2", async () => {
		class TestController extends BaseController {
			handle() {
				const testCookie = Cookies.get("c");
				const testHeader = Headers.get("h");
				return new Response(`Cookie: ${testCookie}, Header: ${testHeader}`);
			}
		}
		const routes = get("/hello", TestController);

		const app = createApplication({ routes });

		const request = new Request("http://example.com/hello");
		const context = mockIntegrationContext({
			cookies: { c: "cookie" },
			headers: { h: "header" },
		});

		const response = await app.handleRequest(request, context);
		expect(await response.text()).toBe("Cookie: cookie, Header: header");
	});

	describe("middleware priority configuration", () => {
		test("reorders middleware based on priority", async () => {
			const M1 = mockMiddleware("M1");
			const M2 = mockMiddleware("M2");

			const app = new ApplicationImpl({
				middlewarePriority: [M2, M1],
				routes: get("/test", MockController, { middleware: [M1, M2] }),
			});

			app.bootstrap();
			mockMiddleware.reset();

			await app.handleRequest(new Request("http://example.com/test"), mockIntegrationContext());

			expect(mockMiddleware.log).toEqual(["M2", "M1"]);
		});
	});

	describe("router configuration", () => {
		// These tests are here to ensure that the router configuration is passed
		// through to the router instance. They are not intended to test the
		// functionality of the router itself.
		class ControllerInvalidParam extends BaseController {
			handle(ctx: ControllerContext) {
				return new Response(`ctx.params.nonExistent: ${ctx.params.nonExistent}`);
			}
		}

		test("config flows from app to router - invalid param access throws by default", async () => {
			const app = new ApplicationImpl({
				devMode: { autoRefresh: false },
				routes: get("/user/{id}", ControllerInvalidParam),
			});

			app.bootstrap();
			expect(async () => {
				await app.handleRequest(
					new Request("http://example.com/user/123"),
					mockIntegrationContext(),
				);
			}).toThrow('Route parameter "nonExistent" does not exist');
		});

		test("config flows from app to router - invalid param access can be disabled", async () => {
			const app = new ApplicationImpl({
				development: false,
				throwOnInvalidParamAccess: "never",
				routes: get("/user/{id}", ControllerInvalidParam),
			});

			app.bootstrap();
			const response = await app.handleRequest(
				new Request("http://example.com/user/123"),
				mockIntegrationContext(),
			);

			expect(response.status).toBe(200);
			expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
		});
	});

	describe("URL type inference", () => {
		test("type inference: route without parameters", () => {
			const routes = group({ namePrefix: "users." }, [
				get("/users", MockController, { name: "index" }),
			]);

			// Should infer never for no params
			expectTypeOf(routes).toEqualTypeOf<Routes<{ "users.index": never }>>();

			// This should compile
			const app = new ApplicationImpl({ routes });
			app.bootstrap();
			app.url("users.index");
		});

		test("type inference: route with single parameter", () => {
			const routes = group({ namePrefix: "users." }, [
				get("/users/{id}", MockController, { name: "show" }),
			]);

			// Should infer "id" param name
			expectTypeOf(routes).toEqualTypeOf<Routes<{ "users.show": "id" }>>();

			// These should compile
			const app = new ApplicationImpl({ routes });
			app.bootstrap();
			app.url("users.show", { params: { id: "123" } });
			app.url("users.show", { params: { id: 456 } });
		});

		test("type inference: route with multiple parameters", () => {
			const routes = group({ namePrefix: "posts." }, [
				get("/posts/{postId}/comments/{commentId}", MockController, {
					name: "comments",
				}),
			]);

			// Should infer both param names as union
			expectTypeOf(routes).toEqualTypeOf<Routes<{ "posts.comments": "postId" | "commentId" }>>();

			// This should compile
			const app = new ApplicationImpl({ routes });
			app.bootstrap();
			app.url("posts.comments", { params: { postId: "1", commentId: "2" } });
		});

		test("type inference: multiple routes with different params", () => {
			const routes = group({ namePrefix: "users." }, [
				get("/users", MockController, { name: "index" }),
				get("/users/{id}", MockController, { name: "show" }),
				get("/users/{id}/posts/{postId}", MockController, { name: "posts" }),
			]);

			// Should infer all route names and their param unions
			expectTypeOf(routes).toEqualTypeOf<
				Routes<{
					"users.index": never;
					"users.show": "id";
					"users.posts": "id" | "postId";
				}>
			>();

			// All these should compile
			const app = new ApplicationImpl({ routes });
			app.bootstrap();
			app.url("users.index");
			app.url("users.show", { params: { id: "123" } });
			app.url("users.posts", { params: { id: "1", postId: "2" } });
		});

		test("type inference: nested groups propagate name prefix", () => {
			const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
				get("/", MockController, { name: "index" }),
				get("/{id}", MockController, { name: "show" }),
			]);

			const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

			// Should infer prefixed names and params
			expectTypeOf(apiRoutes).toEqualTypeOf<
				Routes<{
					"api.users.index": never;
					"api.users.show": "id";
				}>
			>();

			// These should compile
			const app = new ApplicationImpl({ routes: apiRoutes });
			app.bootstrap();
			app.url("api.users.index");
			app.url("api.users.show", { params: { id: "789" } });
		});

		test("type inference: mixed groups and routes", () => {
			const postRoutes = group({ namePrefix: "posts." }, [
				get("/posts", MockController, { name: "index" }),
				get("/posts/{id}", MockController, { name: "show" }),
			]);

			const routes = group({ namePrefix: "admin." }, [
				get("/dashboard", MockController, { name: "dashboard" }),
				postRoutes,
			]);

			// Should merge both direct routes and nested group routes
			expectTypeOf(routes).toEqualTypeOf<
				Routes<{
					"admin.dashboard": never;
					"admin.posts.index": never;
					"admin.posts.show": "id";
				}>
			>();

			// All these should compile
			const app = new ApplicationImpl({ routes });
			app.bootstrap();
			app.url("admin.dashboard");
			app.url("admin.posts.index");
			app.url("admin.posts.show", { params: { id: "123" } });
		});
	});

	describe("URL generation integration", () => {
		test("appUrl config flows through to URL generation", async () => {
			class UrlController extends BaseController {
				handle(): Response {
					return new Response(app.url("test"));
				}
			}

			const routes = get("/test", UrlController, { name: "test" });
			const app = createApplication({
				appUrl: {
					overrideHost: "config.example.com:9000",
					overrideProtocol: "https",
				},
				routes,
			});

			const request = new Request("http://localhost/test");
			const response = await app.handleRequest(request, mockIntegrationContext());
			expect(await response.text()).toBe("https://config.example.com:9000/test");
		});

		test("IntegrationContext headers flow through to URL generation", async () => {
			class UrlController extends BaseController {
				handle(): Response {
					return new Response(app.url("test"));
				}
			}

			const routes = get("/test", UrlController, { name: "test" });
			const app = createApplication({ routes });

			const request = new Request("http://localhost/test");
			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-proto": "https",
					"x-forwarded-host": "proxy.example.com:8443",
				},
			});

			const response = await app.handleRequest(request, context);
			expect(await response.text()).toBe("https://proxy.example.com:8443/test");
		});
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
