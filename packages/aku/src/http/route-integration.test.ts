import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { createTypeToken } from "../container/container-key.ts";
import { Container } from "../container/contracts/Container.ts";
import { BaseListener } from "../core/BaseListener.ts";
import { Configuration } from "../core/contracts/Configuration.ts";
import { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { MockController, mockMiddleware } from "../test-utils/http.test-utils.ts";
import { createTestApplication } from "../testing/create-test-application.ts";
import type { ClassController, Controller } from "./Controller.ts";
import { BaseController, type ControllerContext, type ControllerReturn } from "./Controller.ts";
import { any, get, group, post, redirect } from "./helpers.ts";
import { HttpRequestHandledEvent } from "./http-events.ts";
import type { FunctionMiddleware } from "./Middleware.ts";
import { BaseMiddleware } from "./Middleware.ts";
import { MiddlewareSet } from "./MiddlewareSet.ts";
import { Router } from "./Router.ts";

let container: Container;
let router: Router;
let request: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
let controller: MockController;

beforeEach(() => {
	({ container, router, request } = createTestApplication());
	controller = new MockController();
	// Bind the controller instance so routes using MockController class get this instance
	container.bind(MockController, { instance: controller });
	mockMiddleware.reset();
});

// ============================================================================
// Controller Execution
// ============================================================================

describe("controller execution", () => {
	test("handles controller class", async () => {
		class TestController extends BaseController {
			handle(): Response {
				return new Response("From controller class");
			}
		}

		router.register(get("/test", TestController));

		const response = await request("/test");
		expect(await response.text()).toBe("From controller class");
	});

	test("controller class can use dependency injection", async () => {
		const messageKey = createTypeToken<string>();
		container.bind(messageKey, { instance: "injected message" });

		class InjectedController extends BaseController {
			constructor(private message: string = container.get(messageKey)) {
				super();
			}

			handle(): Response {
				return new Response(this.message);
			}
		}

		router.register(get("/hello", InjectedController));

		const response = await request("/hello");
		expect(await response.text()).toBe("injected message");
	});

	test("handles async controller", async () => {
		router.register(get("/async", MockController));
		await request("/async");
		expect(controller.handle).toHaveBeenCalledTimes(1);
	});
});

describe("middleware", () => {
	test("executes class middleware with context", async () => {
		const handleMock: FunctionMiddleware = mock((ctx, next) => {
			return next(ctx);
		});

		class TestMiddleware extends BaseMiddleware {
			handle(
				ctx: ControllerContext,
				next: (ctx: ControllerContext) => Response | Promise<Response>,
			): Response | Promise<Response> {
				expect(ctx.request).toBeInstanceOf(Request);
				expect(ctx.params).toEqual({ page: "foo" });
				return handleMock(ctx, next);
			}
		}

		router.register(
			get("/test/{page}", MockController, {
				name: "test",
				middleware: TestMiddleware,
			}),
		);

		await request("/test/foo");
		expect(handleMock).toHaveBeenCalledTimes(1);
	});

	test("executes function middleware with context", async () => {
		const middleware: FunctionMiddleware = mock((ctx, next) => {
			expect(ctx.request).toBeInstanceOf(Request);
			expect(ctx.params).toEqual({ page: "foo" });
			return next(ctx);
		});

		router.register(
			get("/test/{page}", MockController, {
				name: "test",
				middleware,
			}),
		);

		await request("/test/foo");
		expect(middleware).toHaveBeenCalledTimes(1);
	});

	test("executes multiple middleware in correct order", async () => {
		const middleware0 = mockMiddleware("m0");
		const middleware1 = mockMiddleware("m1");
		const middleware2 = mockMiddleware("m2");

		router.register(
			group({ middleware: middleware0 }, [
				get(
					"/test",
					() => {
						mockMiddleware.beforeAfterLog.push("handler");
						return new Response("OK");
					},
					{ middleware: [middleware1, middleware2] },
				),
			]),
		);

		await request("/test");
		expect(mockMiddleware.beforeAfterLog).toEqual([
			"m0:before",
			"m1:before",
			"m2:before",
			"handler",
			"m2:after",
			"m1:after",
			"m0:after",
		]);
	});

	test("withoutMiddleware works with classes", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");

		router.register(
			group(
				{
					middleware: [M1, M2],
				},
				[
					get("/test", MockController, {
						withoutMiddleware: M1,
					}),
				],
			),
		);

		await request("/test");
		expect(mockMiddleware.log).toEqual(["M2"]);
	});

	test("withoutMiddleware works in nested groups", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");
		const M3 = mockMiddleware("M3");

		const outerRoutes = group({ middleware: [M1, M2] }, [
			group({ withoutMiddleware: M1, middleware: M3 }, [get("/test", MockController)]),
		]);

		router.register(outerRoutes);
		await request("/test");

		expect(mockMiddleware.log).toEqual(["M2", "M3"]);
	});

	test("route middleware can re-add previously removed middleware", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");

		const innerRoutes = group({ withoutMiddleware: M1 }, [
			get("/test", MockController, { middleware: M1 }),
		]);
		const outerRoutes = group({ middleware: [M1, M2] }, [innerRoutes]);

		router.register(outerRoutes);
		await request("/test");

		expect(mockMiddleware.log).toEqual(["M2", "M1"]);
	});

	test("withoutMiddleware: 'all' removes all parent middleware", async () => {
		const M1 = mockMiddleware("M1");
		const M2 = mockMiddleware("M2");
		const M3 = mockMiddleware("M3");

		router.register(
			group({ middleware: [M1, M2] }, [
				get("/test", MockController, { withoutMiddleware: "all", middleware: M3 }),
			]),
		);

		await request("/test");
		expect(mockMiddleware.log).toEqual(["M3"]);
	});

	test("middleware can short-circuit", async () => {
		class AuthMiddleware extends BaseMiddleware {
			handle(
				_ctx: ControllerContext,
				_next: (ctx: ControllerContext) => Response | Promise<Response>,
			): Response {
				return new Response("Unauthorized");
			}
		}

		const route = get("/protected", MockController, {
			middleware: AuthMiddleware,
		});

		router.register(route);

		const response = await request("/protected");
		expect(await response.text()).toBe("Unauthorized");
		expect(controller.handle).not.toHaveBeenCalled();
	});

	test("middleware can replace request", async () => {
		class ModifyRequestMiddleware extends BaseMiddleware {
			handle(
				ctx: ControllerContext,
				next: (ctx: ControllerContext) => Response | Promise<Response>,
			): Response | Promise<Response> {
				const headers = new Headers(ctx.request.headers);
				headers.set("X-Custom", "Modified");
				const modifiedRequest = new Request(ctx.request.url, {
					method: ctx.request.method,
					headers,
				});
				const modifiedCtx = { ...ctx, request: modifiedRequest };
				return next(modifiedCtx);
			}
		}

		const route = get(
			"/test",
			({ request }) => {
				return new Response(request.headers.get("X-Custom") || "Not found");
			},
			{ middleware: ModifyRequestMiddleware },
		);

		router.register(route);

		const response = await request("/test");
		expect(await response.text()).toBe("Modified");
	});

	test("applies middleware to all routes in group", async () => {
		const M = mockMiddleware("GroupMiddleware");

		const routes = group({ prefix: "/api", middleware: M }, [
			get("/v1", () => {
				mockMiddleware.log.push("v1");
				return new Response("V1");
			}),
			get("/v2", () => {
				mockMiddleware.log.push("v2");
				return new Response("V2");
			}),
		]);

		router.register(routes);

		mockMiddleware.reset();
		await request("/api/v1");
		expect(mockMiddleware.log).toEqual(["GroupMiddleware", "v1"]);

		mockMiddleware.reset();
		await request("/api/v2");
		expect(mockMiddleware.log).toEqual(["GroupMiddleware", "v2"]);
	});
});

// ============================================================================
// Middleware Priority
// ============================================================================

describe("middleware priority", () => {
	test("sorts middleware according to priority list", async () => {
		const Auth = mockMiddleware("Auth");
		const RateLimit = mockMiddleware("RateLimit");
		const Logger = mockMiddleware("Logger");
		const CORS = mockMiddleware("CORS");

		({ container, router, request } = createTestApplication({
			middlewarePriority: [Auth, RateLimit, Logger],
		}));

		router.register(
			get(
				"/test",
				() => {
					mockMiddleware.beforeAfterLog.push("handler");
					return new Response("OK");
				},
				{
					middleware: [CORS, Logger, Auth, RateLimit],
				},
			),
		);

		await request("/test");

		// Priority middleware (Auth, RateLimit, Logger) execute first in priority order
		// Non-priority middleware (CORS) follows in original relative order
		expect(mockMiddleware.beforeAfterLog).toEqual([
			"Auth:before",
			"RateLimit:before",
			"Logger:before",
			"CORS:before",
			"handler",
			"CORS:after",
			"Logger:after",
			"RateLimit:after",
			"Auth:after",
		]);
	});

	test("sorts middleware once during registration, not per request", async () => {
		const Auth = mockMiddleware("Auth");
		const RateLimit = mockMiddleware("RateLimit");

		const applyPrioritySpy = spyOn(MiddlewareSet.prototype, "applyPriority");

		container = new ContainerImpl();
		container.singletonInstance(Container, container);
		container.singletonInstance(Configuration, {
			middlewarePriority: [Auth, RateLimit],
		});
		router = container.get(Router);

		// Register routes - they share the same MiddlewareSet
		router.register(
			group({ middleware: [RateLimit, Auth] }, [
				get("/test", MockController),
				get("/test-2", MockController),
			]),
		);

		// Send two requests
		await request("/test");
		await request("/test");

		// applyPriority should be called exactly once (during registration, for the shared MiddlewareSet)
		expect(applyPrioritySpy).toHaveBeenCalledTimes(1);
	});
});

// ============================================================================
// Handler Validation
// ============================================================================

describe("handler validation", () => {
	test("throws helpful error when passing non-Controller class", async () => {
		class NotAController {
			someMethod() {
				return new Response("This won't work");
			}
		}

		router.register(get("/test", NotAController as unknown as ClassController));

		expect(async () => {
			await request("/test");
		}).toThrow(
			"Controller NotAController for /test is a class but does not extend Controller. Class-based handlers must extend the Controller class.",
		);
	});

	test("throws helpful error when Controller returns invalid value", async () => {
		router.register(get("/test", () => "strings are not valid" as unknown as ControllerReturn));

		expect(async () => {
			await request("/test");
		}).toThrow(
			"Controller for /test returned an invalid value. Expected Response, ConvertsToResponse, or null, but got: strings are not valid",
		);
	});

	test("accepts function controller (non-class)", async () => {
		const functionController = (ctx: ControllerContext) => {
			return new Response(`Function controller, id: ${ctx.params.id}`);
		};

		router.register(get("/user/{id}", functionController));

		const response = await request("/user/123");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("Function controller, id: 123");
	});

	test("accepts newable function that extends Controller", async () => {
		// A constructor function that extends Controller via prototype
		function NewableController(this: BaseController) {
			this.handle = (ctx: ControllerContext) => {
				return new Response(`Newable controller, id: ${ctx.params.id}`);
			};
		}
		NewableController.prototype = Object.create(BaseController.prototype);
		(NewableController as unknown as { isClassController: boolean }).isClassController = true;

		router.register(get("/item/{id}", NewableController as unknown as ClassController));

		const response = await request("/item/456");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("Newable controller, id: 456");
	});

	test("Error when passing a newable function that does not extends Controller", async () => {
		// A constructor function that extends Controller via prototype
		function NewableController() {
			return {
				handle: (ctx: ControllerContext) => {
					return new Response(`Newable controller, id: ${ctx.params.id}`);
				},
			};
		}

		router.register(get("/item/{id}", NewableController as unknown as Controller));

		expect(async () => {
			await request("/item/456");
		}).toThrow(
			"Controller NewableController for /item/{id} returned an object with a 'handle' method. This can happen if you have a controller that does not extend the BaseController class. Ensure that controller classes extend BaseController",
		);
	});
});

// ============================================================================
// Param Access Checking
// ============================================================================

describe("param access checking", () => {
	class ControllerInvalidParam extends BaseController {
		handle(ctx: ControllerContext) {
			return new Response(`ctx.params.nonExistent: ${ctx.params.nonExistent}`);
		}
	}
	test("throwOnInvalidParamAccess: 'always' throws even when development: false", async () => {
		({ container, router, request } = createTestApplication({
			development: false,
			throwOnInvalidParamAccess: "always",
		}));

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await request("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: 'never' doesn't throw even when development: true", async () => {
		({ container, router, request } = createTestApplication({
			development: true,
			throwOnInvalidParamAccess: "never",
		}));

		router.register(get("/user/{id}", ControllerInvalidParam));

		const response = await request("/user/123");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
	});

	test("throwOnInvalidParamAccess: 'development' throws when development: true", async () => {
		({ container, router, request } = createTestApplication({
			development: true,
			throwOnInvalidParamAccess: "development",
		}));

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await request("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: 'development' doesn't throw when development: false", async () => {
		({ container, router, request } = createTestApplication({
			development: false,
			throwOnInvalidParamAccess: "development",
		}));

		router.register(get("/user/{id}", ControllerInvalidParam));

		const response = await request("/user/123");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ctx.params.nonExistent: undefined");
	});

	test("throwOnInvalidParamAccess: undefined (default) throws when development: true", async () => {
		({ container, router, request } = createTestApplication({ development: true }));

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await request("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("throwOnInvalidParamAccess: undefined (default) throws when development: false", async () => {
		({ container, router, request } = createTestApplication({ development: false }));

		router.register(get("/user/{id}", ControllerInvalidParam));

		expect(async () => {
			await request("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});

	test("valid param access works in all modes", async () => {
		({ container, router, request } = createTestApplication({
			development: true,
			throwOnInvalidParamAccess: "always",
		}));

		let capturedId: string | undefined;
		router.register(
			get("/user/{id}", (ctx: ControllerContext) => {
				capturedId = ctx.params.id; // Should work fine
				return new Response("ok");
			}),
		);

		const response = await request("/user/123");
		expect(response.status).toBe(200);
		expect(capturedId).toBe("123");
	});

	test("rawParams also throws when configured", async () => {
		({ container, router, request } = createTestApplication({ development: true }));

		router.register(
			get("/user/{id}", (ctx: ControllerContext) => {
				const _unused = ctx.rawParams.nonExistent; // Should throw
				return new Response(`ok: ${_unused}`);
			}),
		);

		expect(async () => {
			await request("/user/123");
		}).toThrow('Route parameter "nonExistent" does not exist');
	});
});

// ============================================================================
// Meta Property
// ============================================================================

describe("meta property", () => {
	test("meta is passed to controller context", async () => {
		router.register(get("/test", MockController, { meta: { foo: "bar", num: 42 } }));

		await request("/test");
		expect(controller.meta).toEqual({ foo: "bar", num: 42 });
	});

	test("meta is empty object when not specified", async () => {
		router.register(get("/test", MockController));

		await request("/test");
		expect(controller.meta).toEqual({});
	});
});

// ============================================================================
// Special Routes
// ============================================================================

describe("special routes", () => {
	test("redirect returns 303 by default (changes to GET)", async () => {
		const route = any("/old", redirect("/new"));
		router.register(route);

		const response = await request("/old");
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/new");
	});

	test("redirect with preserveHttpMethod returns 307", async () => {
		const route = post("/old-api", redirect("/new-api", { preserveHttpMethod: true }));
		router.register(route);

		const response = await request("/old-api", { method: "POST" });
		expect(response.status).toBe(307);
		expect(response.headers.get("Location")).toBe("/new-api");
	});

	test("redirect can be returned from a controller", async () => {
		const route = get("/dynamic", () => redirect("/target", { permanent: true }));
		router.register(route);

		const response = await request("/dynamic");
		expect(response.status).toBe(301);
		expect(response.headers.get("Location")).toBe("/target");
	});
});

describe("ConvertsToResponse handling", () => {
	test("controller returning ConvertsToResponse", async () => {
		const route = get("/custom", () => ({
			toResponse: () => new Response("custom", { status: 201 }),
		}));
		router.register(route);

		const response = await request("/custom");
		expect(response.status).toBe(201);
		expect(await response.text()).toBe("custom");
	});

	test("async controller returning ConvertsToResponse", async () => {
		const route = get("/async", async () => ({
			toResponse: () => new Response("async"),
		}));
		router.register(route);

		const response = await request("/async");
		expect(await response.text()).toBe("async");
	});

	test("async controller returning async ConvertsToResponse", async () => {
		const route = get("/async", async () => ({
			toResponse: async () => new Response("async"),
		}));
		router.register(route);

		const response = await request("/async");
		expect(await response.text()).toBe("async");
	});

	test("toResponse returning null", async () => {
		const route = get("/null", () => ({
			toResponse: () => null,
		}));
		router.register(route);

		const response = await request("/null");
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
	});

	test("toResponse returning another ConvertsToResponse (chaining)", async () => {
		const route = get("/chained", () => ({
			toResponse: () => ({
				toResponse: () => new Response("chained"),
			}),
		}));
		router.register(route);

		const response = await request("/chained");
		expect(await response.text()).toBe("chained");
	});

	test("toResponse returning a Promise", async () => {
		const route = get("/promise", () => ({
			toResponse: async () => new Response("promised"),
		}));
		router.register(route);

		const response = await request("/promise");
		expect(await response.text()).toBe("promised");
	});
});

test("HttpRequestHandledEvent allows listeners to access responses", async () => {
	let capturedContext: ControllerContext | undefined;
	let capturedStatus: number | undefined;
	let capturedHeaders: Headers | undefined;
	let capturedBody: Promise<string> | undefined;

	class TestListener extends BaseListener {
		handle(event: HttpRequestHandledEvent) {
			capturedContext = event.context;
			capturedStatus = event.status;
			capturedHeaders = event.headers;

			// Clone and read response body
			const clonedResponse = event.cloneResponse();
			capturedBody = clonedResponse.text();
		}
	}

	container.get(Dispatcher).addListener(HttpRequestHandledEvent, TestListener);

	router.register(
		get("/test/{id}", (ctx) => {
			return new Response(`Hello ${ctx.params.id}`, {
				status: 201,
				headers: { "X-Custom": "test-header" },
			});
		}),
	);

	const response = await request("/test/123");

	expect(response.status).toBe(201);
	expect(await response.text()).toBe("Hello 123");

	expect(capturedStatus).toBe(201);
	expect(capturedHeaders?.get("X-Custom")).toBe("test-header");
	expect(capturedContext?.params.id).toBe("123");
	// Check that the listener can clone and consume the response body
	expect(await capturedBody).toBe("Hello 123");
});
