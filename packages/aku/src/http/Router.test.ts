import { beforeEach, describe, expect, expectTypeOf, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { Configuration } from "../core/contracts/Configuration.ts";
import { MockController, mockController } from "../test-utils/http.test-utils.ts";
import { delete_, get, group, isIn, match, options, patch, post, put } from "./helpers.ts";
import { BaseMiddleware } from "./Middleware.ts";
import { MiddlewareSet } from "./MiddlewareSet.ts";
import { Router } from "./Router.ts";
import { RouteUrlGenerator } from "./RouteUrlGenerator.ts";
import type { Routes } from "./router-types.ts";

/**
 * Router Unit Tests
 *
 * These tests verify routing logic in isolation using router.lookup().
 * For integration tests that require the full application stack
 * (middleware, controllers, DI, etc.), see routing.integration.test.tsx
 */

let router: Router;

beforeEach(() => {
	router = new Router({});
});

const lookup = (url: string, method = "GET") => {
	if (url.startsWith("//")) {
		url = "https:" + url;
	} else if (url.startsWith("/")) {
		url = "https://example.com" + url;
	}
	return router.lookup(new Request(url, { method })).match;
};

// ============================================================================
// Basic Route Registration
// ============================================================================

test("handles basic GET route", () => {
	router.register(get("/hello", MockController));

	const match = lookup("/hello");
	expect(match?.route.path).toBe("/hello");
});

test("handles POST route", () => {
	router.register(post("/submit", MockController));

	expect(lookup("/submit", "POST")).not.toBeNull();
	expect(lookup("/submit", "GET")).toBeNull();
});

test("handles PUT route", () => {
	router.register(put("/update", MockController));

	expect(lookup("/update", "PUT")).not.toBeNull();
	expect(lookup("/update", "GET")).toBeNull();
});

test("handles PATCH route", () => {
	router.register(patch("/patch", MockController));

	expect(lookup("/patch", "PATCH")).not.toBeNull();
	expect(lookup("/patch", "GET")).toBeNull();
});

test("handles DELETE route", () => {
	router.register(delete_("/delete", MockController));

	expect(lookup("/delete", "DELETE")).not.toBeNull();
	expect(lookup("/delete", "GET")).toBeNull();
});

test("handles OPTIONS route", () => {
	router.register(options("/cors", MockController));

	expect(lookup("/cors", "OPTIONS")).not.toBeNull();
	expect(lookup("/cors", "GET")).toBeNull();
});

test("handles route parameters", () => {
	router.register(get("/user/{id}", MockController));

	const match = lookup("/user/123");
	expect(match?.params).toEqual({ id: "123" });
});

test("handles route parameters starting with digits", () => {
	router.register(get("/item/{0id}/detail/{1name}", MockController));

	const match = lookup("/item/abc123/detail/xyz789");
	expect(match?.params).toEqual({ "0id": "abc123", "1name": "xyz789" });
});

test("handles multiple route parameters", () => {
	router.register(get("/posts/{postId}/comments/{commentId}", MockController));

	const match = lookup("/posts/42/comments/7");
	expect(match?.params).toEqual({ postId: "42", commentId: "7" });
});

test("returns 404 for unmatched route", () => {
	router.register(get("/hello", MockController));

	const match = lookup("/notfound");
	expect(match).toBeNull();
});

test("trailing slashes are ignored for matching", () => {
	router.register(get("/users", MockController));

	expect(lookup("/users")).not.toBeNull();
	expect(lookup("/users/")).not.toBeNull();
});

test("route defined with trailing slash matches path without trailing slash", () => {
	router.register(get("/posts/", MockController));

	expect(lookup("/posts/")).not.toBeNull();
	expect(lookup("/posts")).not.toBeNull();
});

describe("route groups", () => {
	test("applies prefix to routes", () => {
		const mc1 = mockController();
		const mc2 = mockController();
		const routes = group(
			{
				prefix: "/admin",
			},
			[get("/dashboard", mc1), get("/users", mc2)],
		);

		router.register(routes);

		expect(lookup("/admin/dashboard")).not.toBeNull();
		expect(lookup("/admin/users")).not.toBeNull();
		expect(lookup("/dashboard")).toBeNull();
	});

	test("applies domain to routes in group", () => {
		router.register(group({ domain: "api.example.com" }, [get("/status", MockController)]));

		expect(lookup("//api.example.com/status")).not.toBeNull();
		expect(lookup("/status")).toBeNull();
	});

	test("supports nested groups", () => {
		const mc1 = mockController();
		const mc2 = mockController();
		const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
			get("/", mc1, { name: "index" }),
			get("/{id}", mc2, { name: "show" }),
		]);

		const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

		router.register(apiRoutes);

		const match1 = lookup("/api/users/");
		expect(match1).not.toBeNull();

		const match2 = lookup("/api/users/123");
		expect(match2?.params).toEqual({ id: "123" });

		// Type check
		expectTypeOf(apiRoutes).toEqualTypeOf<
			Routes<{ "api.users.index": never; "api.users.show": "id" }>
		>();
	});
});

// ============================================================================
// Parameter Constraints
// ============================================================================

describe("parameter constraints", () => {
	test("constrained parameter always consumes route", () => {
		router.register(
			group([
				get("/user/{numeric}", MockController, {
					where: { numeric: "numeric" },
				}),
				get("/user/{any}", MockController),
			]),
		);

		const match = lookup("/user/abc");
		expect(match).toBeNull();
	});

	test("whereNumber constraint", () => {
		router.register(get("/user/{id}", MockController, { where: { id: "numeric" } }));

		const match1 = lookup("/user/123");
		expect(match1?.params).toEqual({ id: "123" });

		const match2 = lookup("/user/abc");
		expect(match2).toBeNull();
	});

	test("whereAlphaNumeric allows letters and numbers", () => {
		router.register(
			get("/category/{slug}", MockController, {
				where: { slug: "alphanumeric" },
			}),
		);

		expect(lookup("/category/news")?.params).toEqual({ slug: "news" });

		expect(lookup("/category/news123")?.params).toEqual({ slug: "news123" });

		expect(lookup("/category/news-123")).toBeNull();
	});

	test("whereAlphaNumeric constraint", () => {
		router.register(get("/post/{slug}", MockController, { where: { slug: "alphanumeric" } }));

		expect(lookup("/post/post123")?.params).toEqual({ slug: "post123" });

		expect(lookup("/post/post-123")).toBeNull();
	});

	test("whereUuid constraint", () => {
		router.register(get("/resource/{uuid}", MockController, { where: { uuid: "uuid" } }));

		const validUuid = "550e8400-e29b-41d4-a716-446655440000";
		expect(lookup(`/resource/${validUuid}`)?.params).toEqual({ uuid: validUuid });

		expect(lookup("/resource/not-a-uuid")).toBeNull();
	});

	test("whereUlid constraint", () => {
		router.register(get("/item/{ulid}", MockController, { where: { ulid: "ulid" } }));

		const validUlid = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
		expect(lookup(`/item/${validUlid}`)?.params).toEqual({ ulid: validUlid });

		expect(lookup("/item/not-a-ulid")).toBeNull();
	});

	test("whereIn constraint", () => {
		router.register(
			get("/status/{type}", MockController, {
				where: { type: isIn(["active", "inactive", "pending"]) },
			}),
		);

		expect(lookup("/status/active")?.params).toEqual({ type: "active" });

		expect(lookup("/status/deleted")).toBeNull();
	});

	test("isIn handles regex special characters", () => {
		router.register(
			get("/file/{ext}", MockController, {
				where: {
					ext: isIn([".txt", ".md", "c++", "node.js", "[test]", "(group)"]),
				},
			}),
		);

		expect(lookup("/file/.txt")?.params).toEqual({ ext: ".txt" });

		expect(lookup("/file/.md")?.params).toEqual({ ext: ".md" });

		expect(lookup("/file/c++")?.params).toEqual({ ext: "c++" });

		expect(lookup("/file/node.js")?.params).toEqual({ ext: "node.js" });

		expect(lookup("/file/[test]")?.params).toEqual({ ext: "[test]" });

		expect(lookup("/file/(group)")?.params).toEqual({ ext: "(group)" });

		// Should not match something that looks like it matches the regex pattern
		expect(lookup("/file/XXtxt")).toBeNull(); // should not match .txt (. is literal)
		expect(lookup("/file/cXX")).toBeNull(); // should not match c++ (+ is literal)
		expect(lookup("/file/test")).toBeNull(); // should not match [test] (brackets are literal)
	});

	test("where with custom regex", () => {
		router.register(
			get("/year/{year}", MockController, {
				where: { year: /^(19|20)\d{2}$/ },
			}),
		);

		expect(lookup("/year/2024")?.params).toEqual({ year: "2024" });

		expect(lookup("/year/3024")).toBeNull();
	});

	test("where with incorrect parameter", () => {
		router.register(
			get("/year/{param}", MockController, {
				where: { notParam: "alphanumeric" } as any,
			}),
		);

		const match = lookup("/year/foo");
		expect(match).toBeNull();
	});

	test("multiple constraints on same route", () => {
		router.register(
			get("/posts/{postId}/comments/{commentId}", MockController, {
				where: { postId: "numeric", commentId: "numeric" },
			}),
		);

		expect(lookup("/posts/123/comments/456")?.params).toEqual({
			postId: "123",
			commentId: "456",
		});

		expect(lookup("/posts/abc/comments/456")).toBeNull();
	});

	test("group-level constraints apply to all routes in group", () => {
		const mc1 = mockController();
		const mc2 = mockController();

		router.register(
			group({ prefix: "/admin", where: { id: "numeric" } }, [
				get("/{id}", mc1),
				get("/{id}/edit", mc2),
			]),
		);

		// First route should accept numeric id
		const match1 = lookup("/admin/123");
		expect(match1?.params).toEqual({ id: "123" });

		// Second route should accept numeric id
		const match2 = lookup("/admin/456/edit");
		expect(match2?.params).toEqual({ id: "456" });

		// First route should reject non-numeric id
		expect(lookup("/admin/abc")).toBeNull();

		// Second route should reject non-numeric id
		expect(lookup("/admin/xyz/edit")).toBeNull();
	});

	test("route-level constraints override group-level constraints", () => {
		router.register(
			group({ where: { id: "numeric" } }, [
				get("/post/{id}", MockController, { where: { id: "uuid" } }),
			]),
		);

		// Should match uuid, not numeric (route overrides group)
		const validUuid = "550e8400-e29b-41d4-a716-446655440000";
		expect(lookup(`/post/${validUuid}`)?.params).toEqual({ id: validUuid });

		// Should reject numeric (group constraint was overridden)
		expect(lookup("/post/123")).toBeNull();
	});
});

// ============================================================================
// Global Patterns
// ============================================================================

describe("global patterns", () => {
	test("parameterPatterns validates matching parameters", () => {
		const mc1 = mockController();
		const mc2 = mockController();

		router.register(
			group({ parameterPatterns: { id: /^\d+$/ } }, [
				get("/user/{id}", mc1),
				get("/post/{id}", mc2),
			]),
		);

		expect(lookup("/user/123")?.params).toEqual({ id: "123" });

		expect(lookup("/user/abc")).toBeNull();

		expect(lookup("/post/456")?.params).toEqual({ id: "456" });

		expect(lookup("/post/xyz")).toBeNull();
	});

	test("parameterPatterns ignores non-existent parameters", () => {
		const mc1 = mockController();
		const mc2 = mockController();

		router.register(
			group({ parameterPatterns: { id: "numeric" } }, [
				get("/user/{userId}", mc1),
				get("/post/{postId}", mc2),
			]),
		);

		// Routes without 'id' parameter should match even with parameterPatterns for 'id'
		expect(lookup("/user/abc")?.params).toEqual({ userId: "abc" });

		expect(lookup("/post/xyz")?.params).toEqual({ postId: "xyz" });
	});

	test("where and parameterPatterns work together", () => {
		router.register(
			get("/post/{postId}/comment/{commentId}", MockController, {
				where: { postId: "numeric" }, // Required - must be numeric
				parameterPatterns: { commentId: "numeric" }, // Optional - only checked if present
			}),
		);

		// Both numeric - success
		expect(lookup("/post/123/comment/456")?.params).toEqual({
			postId: "123",
			commentId: "456",
		});

		// postId not numeric - 404 (where constraint)
		expect(lookup("/post/abc/comment/456")).toBeNull();

		// commentId not numeric - 404 (parameterPatterns constraint)
		expect(lookup("/post/123/comment/xyz")).toBeNull();
	});

	test("group-level parameterPatterns apply to all child routes", () => {
		const mc1 = mockController();
		const mc2 = mockController();
		const mc3 = mockController();

		router.register(
			group({ prefix: "/admin", parameterPatterns: { id: "numeric" } }, [
				get("/{id}", mc1),
				get("/{id}/edit", mc2),
				get("/users/{userId}", mc3), // Different param name - not affected
			]),
		);

		// First route - numeric id passes
		expect(lookup("/admin/123")?.params).toEqual({ id: "123" });

		// First route - non-numeric id fails
		expect(lookup("/admin/abc")).toBeNull();

		// Second route - numeric id passes
		expect(lookup("/admin/456/edit")?.params).toEqual({ id: "456" });

		// Second route - non-numeric id fails
		expect(lookup("/admin/xyz/edit")).toBeNull();

		// Third route - different param name, not affected by parameterPatterns for 'id'
		expect(lookup("/admin/users/abc")?.params).toEqual({ userId: "abc" });
	});

	test("parameterPatterns merge through nested groups", () => {
		const mc1 = mockController();
		const mc2 = mockController();

		router.register(
			group({ parameterPatterns: { id: "numeric" } }, [
				group({ parameterPatterns: { slug: "alphanumeric" } }, [
					get("/post/{id}", mc1),
					get("/category/{slug}", mc2),
				]),
			]),
		);

		// Post with numeric id - success
		expect(lookup("/post/123")?.params).toEqual({ id: "123" });

		// Post with non-numeric id - 404
		expect(lookup("/post/abc")).toBeNull();

		// Category with alphanumeric slug - success
		expect(lookup("/category/news")?.params).toEqual({ slug: "news" });

		// Category with alphanumeric slug including numbers - success
		expect(lookup("/category/news123")?.params).toEqual({ slug: "news123" });

		// Category with non-alphanumeric slug (hyphen) - 404
		expect(lookup("/category/news-123")).toBeNull();
	});

	test("parameterPatterns can constrain multiple different parameters", () => {
		const mc1 = mockController();
		const mc2 = mockController();
		const mc3 = mockController();

		router.register(
			group(
				{
					parameterPatterns: {
						id: "numeric",
						slug: "alphanumeric",
						uuid: "uuid",
					},
				},
				[get("/user/{id}", mc1), get("/category/{slug}", mc2), get("/resource/{uuid}", mc3)],
			),
		);

		// Valid id
		expect(lookup("/user/123")?.params).toEqual({ id: "123" });

		// Invalid id
		expect(lookup("/user/abc")).toBeNull();

		// Valid slug
		expect(lookup("/category/news")?.params).toEqual({ slug: "news" });

		// Valid slug with numbers
		expect(lookup("/category/news123")?.params).toEqual({ slug: "news123" });

		// Invalid slug (hyphen not allowed)
		expect(lookup("/category/news-123")).toBeNull();

		// Valid uuid
		const validUuid = "550e8400-e29b-41d4-a716-446655440000";
		expect(lookup(`/resource/${validUuid}`)?.params).toEqual({ uuid: validUuid });

		// Invalid uuid
		expect(lookup("/resource/not-a-uuid")).toBeNull();
	});
});

// ============================================================================
// Domain Routing
// ============================================================================

describe("domain routing", () => {
	test("matches routes on specific domain", () => {
		router.register(get("/api", MockController, { domain: "api.example.com" }));

		expect(lookup("//different.com/api")).toBeNull();
	});

	test("extracts single domain parameter", () => {
		router.register(get("/users", MockController, { domain: "{account}.example.com" }));

		expect(lookup("//acme.example.com/users")?.params).toEqual({ account: "acme" });

		expect(lookup("//example.com/api")).toBeNull();
	});

	test("static domain pattern takes precedence over parametric domain pattern", () => {
		const controller1 = mockController();
		const controller2 = mockController();
		router.register(
			group([
				// define parametric pattern first
				get("/users", controller1, { domain: "{account}.example.com" }),
				get("/users", controller2, { domain: "www.example.com" }),
			]),
		);

		const match = lookup("//www.example.com/users");
		// Static route should be matched (controller2), not parametric (controller1)
		expect(match?.route.controller).toBe(controller2);
	});

	test("parametric domain pattern matches when static doesn't", () => {
		router.register(
			group([
				get("/users", MockController, { domain: "www.example.com" }),
				get("/users", MockController, { domain: "{account}.example.com" }),
			]),
		);

		expect(lookup("//acme.example.com/users")?.params).toEqual({ account: "acme" });
	});

	test("extracts multiple domain parameters", () => {
		router.register(get("/", MockController, { domain: "{subdomain}.{region}.example.com" }));

		expect(lookup("//api.us.example.com/")?.params).toEqual({
			subdomain: "api",
			region: "us",
		});
	});

	test("handles multi-level subdomains", () => {
		router.register(get("/", MockController, { domain: "{a}.{b}.{c}.example.com" }));

		expect(lookup("//x.y.z.example.com/")?.params).toEqual({ a: "x", b: "y", c: "z" });
	});

	test("combines domain and path parameters", () => {
		router.register(get("/users/{id}", MockController, { domain: "{account}.example.com" }));

		expect(lookup("//acme.example.com/users/123")?.params).toEqual({
			account: "acme",
			id: "123",
		});
	});

	test("domain-specific route takes precedence over domain-agnostic", () => {
		const domainController = mockController();
		const generalController = mockController();

		router.register(get("/users", generalController));
		router.register(get("/users", domainController, { domain: "api.example.com" }));

		const match = lookup("//api.example.com/users");
		expect(match?.route.controller).toBe(domainController);
	});

	test("falls back to domain-agnostic when domain doesn't match", () => {
		const domainController = mockController();
		const generalController = mockController();

		router.register(get("/users", generalController));
		router.register(get("/users", domainController, { domain: "api.example.com" }));

		const match = lookup("//other.example.com/users");
		expect(match?.route.controller).toBe(generalController);
	});

	test("applies domain to routes in group", () => {
		const controller1 = mockController();
		const controller2 = mockController();

		router.register(
			group({ domain: "{tenant}.app.com" }, [
				get("/dashboard", controller1),
				get("/settings", controller2),
			]),
		);

		expect(lookup("//acme.app.com/dashboard")?.params).toEqual({ tenant: "acme" });

		expect(lookup("//widgets.app.com/settings")?.params).toEqual({ tenant: "widgets" });
	});

	test("group domain applies to all child routes", () => {
		const controller1 = mockController();
		const controller2 = mockController();

		router.register(
			group({ domain: "{tenant}.app.com" }, [
				get("/api/status", controller1),
				get("/api/health", controller2),
			]),
		);

		expect(lookup("//acme.app.com/api/status")?.params).toEqual({ tenant: "acme" });

		expect(lookup("//acme.app.com/api/health")?.params).toEqual({ tenant: "acme" });
	});

	test("combines path prefix and domain in groups", () => {
		router.register(
			group({ prefix: "/api", domain: "{tenant}.app.com" }, [get("/status", MockController)]),
		);

		expect(lookup("//acme.app.com/api/status")?.params).toEqual({ tenant: "acme" });
	});

	test("combines domain parameters and prefix parameters in groups", () => {
		router.register(
			group({ prefix: "/users/{userId}", domain: "{tenant}.app.com" }, [
				get("/profile", MockController),
			]),
		);

		expect(lookup("//acme.app.com/users/123/profile")?.params).toEqual({
			tenant: "acme",
			userId: "123",
		});
	});

	test("generates correct URL for named domain route", () => {
		const route = get("/users/{id}", MockController, {
			name: "users.show",
			domain: "{subdomain}.example.com",
		});

		const container = new ContainerImpl();
		const config = {};
		container.singletonInstance(Configuration, config);
		const urlGenerator = new RouteUrlGenerator(container, config);
		urlGenerator.register(route);

		expect(urlGenerator.url("users.show", { params: { subdomain: "acme", id: 123 } })).toBe(
			"//acme.example.com/users/123",
		);
	});
});

// ============================================================================
// Wildcard Routes
// ============================================================================

describe("wildcard routes", () => {
	test("named wildcard matches any subpath", () => {
		router.register(get("/files/{...rest}", MockController));

		expect(lookup("/files/a")).not.toBeNull();
		expect(lookup("/files/a/b/c")).not.toBeNull();
		expect(lookup("/files/documents/2024/report.pdf")).not.toBeNull();
		expect(lookup("/not-files/documents/2024/report.pdf")).toBeNull();
	});

	test("named wildcard captures remaining path", () => {
		router.register(get("/files/{...path}", MockController));

		expect(lookup("/files/document.pdf")?.params).toEqual({ path: "document.pdf" });

		expect(lookup("/files/docs/2024/report.pdf")?.params).toEqual({
			path: "docs/2024/report.pdf",
		});
	});

	test("named wildcard with prefix parameters", () => {
		router.register(get("/users/{userId}/files/{...path}", MockController));

		expect(lookup("/users/123/files/photos/vacation.jpg")?.params).toEqual({
			userId: "123",
			path: "photos/vacation.jpg",
		});
	});

	test("wildcards in route groups", () => {
		router.register(group({ prefix: "/api" }, [get("/{...path}", MockController)]));

		expect(lookup("/api/v1/users/list")?.params).toEqual({ path: "v1/users/list" });
	});
});

// ============================================================================
// Mixed Params (Partial Segment Parameters)
// ============================================================================

describe("mixed params in same segment", () => {
	test("simple prefix pattern matches correctly", () => {
		router.register(get("/npm/@{scope}/{package}", MockController));

		expect(lookup("/npm/@vue/router")?.params).toEqual({ scope: "vue", package: "router" });
	});

	test("simple prefix pattern does not match without prefix", () => {
		router.register(get("/npm/@{scope}/{package}", MockController));

		expect(lookup("/npm/vue/router")).toBeNull();
	});

	test("simple suffix pattern matches correctly", () => {
		router.register(get("/files/{id}.txt", MockController));

		expect(lookup("/files/123.txt")?.params).toEqual({ id: "123" });
	});

	test("simple suffix pattern does not match without suffix", () => {
		router.register(get("/files/{id}.txt", MockController));

		expect(lookup("/files/123.pdf")).toBeNull();
	});

	test("multiple params in same segment", () => {
		router.register(get("/files/{category}/{id},name={name}.txt", MockController));

		expect(lookup("/files/docs/123,name=report.txt")?.params).toEqual({
			category: "docs",
			id: "123",
			name: "report",
		});
	});

	test("multiple params in same segment does not match wrong pattern", () => {
		router.register(get("/files/{id},name={name}.txt", MockController));

		expect(lookup("/files/123.txt")).toBeNull();
	});

	test("mixed params work with regular params", () => {
		router.register(get("/api/v{version}/users/{userId}", MockController));

		expect(lookup("/api/v2/users/123")?.params).toEqual({ version: "2", userId: "123" });
	});

	test("multiple routes with different patterns select correctly", () => {
		const controller1 = mockController();
		const controller2 = mockController();

		router.register(get("/npm/@{scope}/{package}", controller1));
		router.register(get("/npm/{package}/{version}", controller2));

		const match1 = lookup("/npm/@vue/router");
		expect(match1?.params).toEqual({
			scope: "vue",
			package: "router",
		});
		expect(match1?.route.controller).toBe(controller1);

		const match2 = lookup("/npm/express/4.18.2");
		expect(match2?.params).toEqual({
			package: "express",
			version: "4.18.2",
		});
		expect(match2?.route.controller).toBe(controller2);
	});

	test("mixed params in domain patterns", () => {
		router.register(get("/status", MockController, { domain: "api-{version}.example.com" }));

		expect(lookup("//api-v2.example.com/status")?.params).toEqual({ version: "v2" });
	});

	test("mixed params in domain does not match different pattern", () => {
		router.register(get("/status", MockController, { domain: "api-{version}.example.com" }));

		expect(lookup("//apiv2.example.com/status")).toBeNull();
	});

	test("mixed params with special regex characters in literal parts", () => {
		router.register(get("/files/{id}.{ext}", MockController));

		expect(lookup("/files/report.pdf")?.params).toEqual({ id: "report", ext: "pdf" });
	});

	test("mixed params do not match when literal part is missing", () => {
		router.register(get("/api/v{version}/status", MockController));

		expect(lookup("/api/2/status")).toBeNull();
	});
});

// ============================================================================
// URL Encoding/Decoding
// ============================================================================

describe("URL encoding and decoding", () => {
	test("decodes encoded slashes in route parameters", () => {
		router.register(get("/foo/{param}/quux", MockController));

		const match = lookup("/foo/bar%2Fbaz/quux");
		// Router returns raw encoded values - RequestHandler decodes them
		expect(match?.params).toEqual({ param: "bar%2Fbaz" });
		expect(match?.url.pathname).toBe("/foo/bar%2Fbaz/quux");
	});

	test("decodes encoded characters in multiple parameters", () => {
		router.register(get("/posts/{postId}/comments/{commentId}", MockController));

		const match = lookup("/posts/hello%20world/comments/foo%26bar");
		// Router returns raw encoded values
		expect(match?.params).toEqual({
			postId: "hello%20world",
			commentId: "foo%26bar",
		});
		expect(match?.url.pathname).toBe("/posts/hello%20world/comments/foo%26bar");
	});

	test("decodes wildcard parameters with encoded characters", () => {
		router.register(get("/files/{...path}", MockController));

		const match = lookup("/files/docs%2F2024%2Freport.pdf");
		// Router returns raw encoded values
		expect(match?.params).toEqual({ path: "docs%2F2024%2Freport.pdf" });
		expect(match?.url.pathname).toBe("/files/docs%2F2024%2Freport.pdf");
	});

	test("handles invalid percent encoding gracefully", () => {
		router.register(get("/test/{param}", MockController));

		// Invalid encoding should use the original value
		const match = lookup("/test/foo%2");
		expect(match?.params).toEqual({ param: "foo%2" });
	});

	test("query parameters are decoded by URL object", () => {
		router.register(get("/search", MockController));

		const match = lookup("/search?foo=bar+baz%2Fquux");
		expect(match?.url.searchParams.get("foo")).toBe("bar baz/quux");
	});
});

describe("MiddlewareSet sharing", () => {
	// Note: These tests verify route definition structure, not middleware execution
	// For middleware execution tests, see routing.integration.test.tsx

	// Dummy middleware classes for testing
	class M1 extends BaseMiddleware {
		handle() {
			return new Response();
		}
	}
	class M2 extends BaseMiddleware {
		handle() {
			return new Response();
		}
	}

	test("sibling routes with no middleware both have null middleware", () => {
		const routes = group([get("/a", MockController), get("/b", MockController)]);

		expect(routes[0].middleware).toBe(null);
		expect(routes[1].middleware).toBe(null);
	});

	test("sibling routes in group with middleware share MiddlewareSet instance", () => {
		const routes = group({ middleware: M1 }, [
			get("/a", MockController),
			get("/b", MockController),
		]);

		expect(routes[0].middleware).toBe(routes[1].middleware);
		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
	});

	test("routes with different middleware get different MiddlewareSet instances", () => {
		const routes = group([
			get("/a", MockController, { middleware: M1 }),
			get("/b", MockController, { middleware: M2 }),
		]);

		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[1].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[0].middleware).not.toBe(routes[1].middleware);
	});

	test("only routes with middleware get a MiddlewareSet", () => {
		const routes = group([
			get("/a", MockController, { middleware: M1 }),
			get("/b", MockController),
		]);

		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[1].middleware).toBe(null);
	});

	test("nested groups: siblings share MiddlewareSet, different groups differ", () => {
		const routes = group({ middleware: M1 }, [
			get("/a", MockController),
			get("/b", MockController),
			group({ middleware: M2 }, [get("/c", MockController), get("/d", MockController)]),
		]);

		// /a and /b share (both have [M1])
		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[0].middleware).toBe(routes[1].middleware);

		// /c and /d share (both have [M1, M2])
		expect(routes[2].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[2].middleware).toBe(routes[3].middleware);

		// /a and /c differ (different middleware)
		expect(routes[0].middleware).not.toBe(routes[2].middleware);
	});

	test("route with withoutMiddleware gets different MiddlewareSet", () => {
		const routes = group({ middleware: [M1, M2] }, [
			get("/a", MockController),
			get("/b", MockController, { withoutMiddleware: M1 }),
		]);

		// Different because /b filters out M1
		expect(routes[0].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[1].middleware).toBeInstanceOf(MiddlewareSet);
		expect(routes[0].middleware).not.toBe(routes[1].middleware);
	});
});

describe("multi-method routes", () => {
	test("match() accepts multiple HTTP methods", () => {
		router.register(match(["GET", "POST"], "/form", MockController));

		expect(lookup("/form", "GET")).not.toBeNull();
		expect(lookup("/form", "POST")).not.toBeNull();
		expect(lookup("/form", "PUT")).toBeNull();
	});

	test("match() accepts non-standard HTTP verbs", () => {
		// Note: Bun doesn't allow custom HTTP methods in Request constructor
		// (normalises to GET/standard methods) but we want to ensure our router
		// supports them on other runtimes that do. Use a Proxy to override the
		// method property for testing.
		const baseRequest = new Request("http://example.com/form");
		const brewRequest = new Proxy(baseRequest, {
			get(target, prop) {
				if (prop === "method") return "BREW";
				return Reflect.get(target, prop);
			},
		});

		expect(brewRequest.method).toEqual("BREW");
		router.register(match(["BREW"], "/form", MockController));

		const match1 = router.lookup(brewRequest);
		expect(match1).not.toBeNull();

		expect(lookup("/form", "GET")).toBeNull();
	});
});
