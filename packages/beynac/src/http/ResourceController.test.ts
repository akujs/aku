import { beforeEach, describe, expect, expectTypeOf, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import type { Container } from "../container/contracts/Container.ts";
import { Configuration } from "../core/contracts/Configuration.ts";
import { createTestApplication, mockMiddleware } from "../test-utils/http-test-utils.ts";
import type { ControllerContext } from "./Controller.ts";
import { apiResource, group, resource } from "./helpers.ts";
import { ResourceController } from "./ResourceController.ts";
import { RouteUrlGenerator } from "./RouteUrlGenerator.ts";
import type { Routes } from "./router-types.ts";

beforeEach(() => {
	mockMiddleware.reset();
});

const getMethodCalled = async (routes: Routes, path: string, method = "GET") => {
	const { handle } = createTestApplication({ routes });
	const response = await handle(path, method);
	return response.status === 200 ? await response.text() : response.status;
};

// ============================================================================
// ResourceController Action Delegation Tests
// ============================================================================

describe("ResourceController", () => {
	test("action determination - GET / calls index()", async () => {
		const response = await getMethodCalled(resource("/photos", TestController), "/photos", "GET");
		expect(response).toBe("index");
	});

	test("action determination - GET /create calls create()", async () => {
		const response = await getMethodCalled(
			resource("/photos", TestController),
			"/photos/create",
			"GET",
		);
		expect(response).toBe("create");
	});

	test("action determination - POST / calls store()", async () => {
		const response = await getMethodCalled(resource("/photos", TestController), "/photos", "POST");
		expect(response).toBe("store");
	});

	test("action determination - GET /{resourceId} calls show()", async () => {
		const response = await getMethodCalled(
			resource("/photos", TestController),
			"/photos/123",
			"GET",
		);
		expect(response).toBe("show");
	});

	test("action determination - GET /{resourceId}/edit calls edit()", async () => {
		const response = await getMethodCalled(
			resource("/photos", TestController),
			"/photos/123/edit",
			"GET",
		);
		expect(response).toBe("edit");
	});

	test("action determination - PUT /{resourceId} calls update()", async () => {
		const response = await getMethodCalled(
			resource("/photos", TestController),
			"/photos/123",
			"PUT",
		);
		expect(response).toBe("update");
	});

	test("action determination - PATCH /{resourceId} calls update()", async () => {
		const response = await getMethodCalled(
			resource("/photos", TestController),
			"/photos/123",
			"PATCH",
		);
		expect(response).toBe("update");
	});

	test("action determination - DELETE /{resourceId} calls destroy()", async () => {
		const response = await getMethodCalled(
			resource("/photos", TestController),
			"/photos/123",
			"DELETE",
		);
		expect(response).toBe("destroy");
	});

	test("default implementations return 404", async () => {
		class EmptyController extends ResourceController {}

		const routes = resource("/empty", EmptyController);

		const indexResponse = await getMethodCalled(routes, "/empty", "GET");
		expect(indexResponse).toBe(404);

		const showResponse = await getMethodCalled(routes, "/empty/123", "GET");
		expect(showResponse).toBe(404);
	});

	test("overridden methods work correctly, others return 404", async () => {
		class PartialController extends ResourceController {
			override index() {
				return new Response("Custom index");
			}
		}

		const routes = resource("/partial", PartialController);

		const indexResponse = await getMethodCalled(routes, "/partial", "GET");
		expect(indexResponse).toBe("Custom index");

		const createResponse = await getMethodCalled(routes, "/partial/create", "GET");
		expect(createResponse).toBe(404);
	});

	test("controller receives correct params", async () => {
		class ParamController extends ResourceController {
			override show(ctx: ControllerContext) {
				return new Response(`ID: ${ctx.params.resourceId}`);
			}
		}

		const response = await getMethodCalled(
			resource("/items", ParamController),
			"/items/abc123",
			"GET",
		);
		expect(response).toBe("ID: abc123");
	});
});

describe("resource", () => {
	test("route names use resource name prefix", () => {
		const routes = resource("/photos", TestController);

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"photos.index": never;
				"photos.create": never;
				"photos.store": never;
				"photos.show": "resourceId";
				"photos.edit": "resourceId";
				"photos.update": "resourceId";
				"photos.destroy": "resourceId";
			}>
		>();

		expect(routes.map((r) => r.routeName)).toEqual([
			"photos.index",
			"photos.create",
			"photos.store",
			"photos.show",
			"photos.edit",
			"photos.update",
			"photos.destroy",
		]);
	});

	test("custom name override works", () => {
		const routes = resource("/photos", TestController, { name: "pics" });

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"pics.index": never;
				"pics.create": never;
				"pics.store": never;
				"pics.show": "resourceId";
				"pics.edit": "resourceId";
				"pics.update": "resourceId";
				"pics.destroy": "resourceId";
			}>
		>();

		expect(routes.map((r) => r.routeName)).toEqual([
			"pics.index",
			"pics.create",
			"pics.store",
			"pics.show",
			"pics.edit",
			"pics.update",
			"pics.destroy",
		]);
	});

	test("only option filters actions", async () => {
		const routes = resource("/photos", TestController, {
			only: ["index", "show"],
		});

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"photos.index": never;
				"photos.show": "resourceId";
			}>
		>();

		// Should work for allowed actions
		const indexResponse = await getMethodCalled(routes, "/photos", "GET");
		expect(indexResponse).toBe("index");

		const showResponse = await getMethodCalled(routes, "/photos/123", "GET");
		expect(showResponse).toBe("show");

		// Should 405 for excluded actions (path exists but method not allowed)
		const storeResponse = await getMethodCalled(routes, "/photos", "POST");
		expect(storeResponse).toBe(405);
	});

	test("except option excludes actions", () => {
		const routes = resource("/photos", TestController, { except: ["destroy"] });

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"photos.index": never;
				"photos.create": never;
				"photos.store": never;
				"photos.show": "resourceId";
				"photos.edit": "resourceId";
				"photos.update": "resourceId";
			}>
		>();

		expect(routes.map((r) => r.routeName)).toEqual([
			"photos.index",
			"photos.create",
			"photos.store",
			"photos.show",
			"photos.edit",
			"photos.update",
		]);
	});

	test("only and except together - except subtracts from only", () => {
		const routes = resource("/photos", TestController, {
			only: ["index", "show", "destroy"],
			except: ["show"],
		});

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"photos.index": never;
				"photos.destroy": "resourceId";
			}>
		>();

		expect(routes.map((r) => r.routeName)).toEqual(["photos.index", "photos.destroy"]);
	});

	test("middleware option applies to all routes", async () => {
		const M1 = mockMiddleware("M1");
		const routes = resource("/photos", TestController, { middleware: M1 });

		await getMethodCalled(routes, "/photos", "GET");
		expect(mockMiddleware.log).toEqual(["M1"]);

		mockMiddleware.reset();

		await getMethodCalled(routes, "/photos/123", "GET");
		expect(mockMiddleware.log).toEqual(["M1"]);
	});

	test("where constraints apply to {resourceId} parameter", async () => {
		const routes = resource("/photos", TestController, {
			where: { resourceId: /^\d+$/ },
		});

		// Numeric resourceId should work
		const numericResponse = await getMethodCalled(routes, "/photos/123", "GET");
		expect(numericResponse).toBe("show");

		// Non-numeric resourceId should 404
		const alphaResponse = await getMethodCalled(routes, "/photos/abc", "GET");
		expect(alphaResponse).toBe(404);
	});

	test("parameterPatterns (global patterns) apply to {resourceId} parameter", async () => {
		const routes = resource("/photos", TestController, {
			parameterPatterns: { resourceId: /^[a-z]+$/ },
		});

		// Alphabetic resourceId should work
		const alphaResponse = await getMethodCalled(routes, "/photos/abc", "GET");
		expect(alphaResponse).toBe("show");

		// Numeric resourceId should 404
		const numericResponse = await getMethodCalled(routes, "/photos/123", "GET");
		expect(numericResponse).toBe(404);
	});

	test("works inside route groups with name prefix", () => {
		const routes = group({ namePrefix: "admin." }, [resource("/photos", TestController)]);

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"admin.photos.index": never;
				"admin.photos.create": never;
				"admin.photos.store": never;
				"admin.photos.show": "resourceId";
				"admin.photos.edit": "resourceId";
				"admin.photos.update": "resourceId";
				"admin.photos.destroy": "resourceId";
			}>
		>();

		const routeNames = routes.map((r) => r.routeName).filter(Boolean);
		expect(routeNames).toContain("admin.photos.index");
		expect(routeNames).toContain("admin.photos.show");
	});

	test("works inside route groups with path prefix", async () => {
		const routes = group({ prefix: "/admin" }, [resource("/photos", TestController)]);

		const response = await getMethodCalled(routes, "/admin/photos", "GET");
		expect(response).toBe("index");
	});

	test("slashes in path convert to dots in route names", () => {
		const routes = resource("/admin/photos", TestController);

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"admin.photos.index": never;
				"admin.photos.create": never;
				"admin.photos.store": never;
				"admin.photos.show": "resourceId";
				"admin.photos.edit": "resourceId";
				"admin.photos.update": "resourceId";
				"admin.photos.destroy": "resourceId";
			}>
		>();

		const routeNames = routes.map((r) => r.routeName).filter(Boolean);
		expect(routeNames).toContain("admin.photos.index");
		expect(routeNames).toContain("admin.photos.show");
	});

	test("multiple slashes convert to multiple dots", () => {
		const routes = resource("/api/v1/users", TestController);

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"api.v1.users.index": never;
				"api.v1.users.create": never;
				"api.v1.users.store": never;
				"api.v1.users.show": "resourceId";
				"api.v1.users.edit": "resourceId";
				"api.v1.users.update": "resourceId";
				"api.v1.users.destroy": "resourceId";
			}>
		>();

		const routeNames = routes.map((r) => r.routeName).filter(Boolean);
		expect(routeNames).toContain("api.v1.users.index");
		expect(routeNames).toContain("api.v1.users.show");
	});
});

describe("apiResource", () => {
	test("excludes create and edit", () => {
		const routes = apiResource("/photos", TestController);

		expectTypeOf(routes).toEqualTypeOf<
			Routes<{
				"photos.index": never;
				"photos.store": never;
				"photos.show": "resourceId";
				"photos.update": "resourceId";
				"photos.destroy": "resourceId";
			}>
		>();

		const routeNames = routes.map((r) => r.routeName);
		expect(routeNames).toEqual([
			"photos.index",
			"photos.store",
			"photos.show",
			"photos.update",
			"photos.destroy",
		]);
	});

	test("apiResource respects only option", () => {
		const routes = apiResource("/photos", TestController, { only: ["index"] });

		const routeNames = routes.map((r) => r.routeName).filter(Boolean);
		expect(routeNames).toHaveLength(1);
		expect(routeNames).toContain("photos.index");
	});

	test("/create matches /{resourceId} with resourceId='create' when using apiResource", async () => {
		// Since /create route is not registered, /photos/create matches /photos/{resourceId}
		const response = await getMethodCalled(
			apiResource("/photos", TestController),
			"/photos/create",
			"GET",
		);
		expect(response).toBe("show"); // Calls show() with resourceId='create'
	});

	test("/{resourceId}/edit matches /{resourceId} with apiResource (no dedicated edit route)", async () => {
		// Since /photos/{resourceId}/edit is not registered with apiResource,
		// /photos/123/edit will match /photos/{resourceId} with resourceId='123'
		// and the path won't match the show pattern, so it returns show
		const response = await getMethodCalled(
			apiResource("/photos", TestController),
			"/photos/123/edit",
			"GET",
		);
		expect(response).toBe(404); // No route matches this pattern in apiResource
	});
});

// ============================================================================
// Type Tests
// ============================================================================

describe("resource type inference", () => {
	let urlGenerator: RouteUrlGenerator;
	let container: Container;
	let config: Configuration;

	beforeEach(() => {
		container = new ContainerImpl();
		config = {};
		container.singletonInstance(Configuration, config);
		urlGenerator = new RouteUrlGenerator(container, config);
	});

	test("routes work with RouteUrlGenerator", () => {
		urlGenerator.register(resource("/photos", TestController));

		// These should compile and work at runtime:
		const url1 = urlGenerator.url("photos.index");
		const url2 = urlGenerator.url("photos.show", { params: { resourceId: "123" } });

		expect(url1).toContain("/photos");
		expect(url2).toContain("/photos/123");
	});

	test("custom name works with RouteUrlGenerator", () => {
		urlGenerator.register(resource("/photos", TestController, { name: "pics" }));

		// Should be able to use custom route names:
		const url = urlGenerator.url("pics.index");
		expect(url).toContain("/photos");
	});

	test("apiResource works with RouteUrlGenerator", () => {
		urlGenerator.register(apiResource("/photos", TestController));

		// These should compile and work:
		const url1 = urlGenerator.url("photos.index");
		const url2 = urlGenerator.url("photos.show", { params: { resourceId: "123" } });

		expect(url1).toContain("/photos");
		expect(url2).toContain("/photos/123");
	});
});

class TestController extends ResourceController {
	override index() {
		return new Response("index");
	}
	override create() {
		return new Response("create");
	}
	override store() {
		return new Response("store");
	}
	override show() {
		return new Response("show");
	}
	override edit() {
		return new Response("edit");
	}
	override update() {
		return new Response("update");
	}
	override destroy() {
		return new Response("destroy");
	}
}
