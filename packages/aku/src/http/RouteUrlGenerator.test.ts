import { beforeEach, describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import type { Container } from "../container/contracts/Container.ts";
import type { Configuration } from "../core/contracts/Configuration.ts";
import { IntegrationContext } from "../integrations/IntegrationContext.ts";
import { MockController, mockIntegrationContext } from "../test-utils/http.test-utils.ts";
import { get, group, resource } from "./helpers.ts";
import { ResourceController } from "./ResourceController.ts";
import { RouteUrlGenerator } from "./RouteUrlGenerator.ts";

describe(RouteUrlGenerator, () => {
	let config: Configuration;
	let container: Container;
	let generator: RouteUrlGenerator;
	const url: RouteUrlGenerator["url"] = (name, params) => generator.url(name, params);
	const register: RouteUrlGenerator["register"] = (routes) => generator.register(routes);

	beforeEach(() => {
		config = {};
		container = new ContainerImpl();
		generator = new RouteUrlGenerator(container, config);
	});

	test("generates URL for named route without parameters", () => {
		register(get("/users", MockController, { name: "users.index" }));
		expect(url("users.index")).toBe("/users");
	});

	test("generates URL for named route with parameters", () => {
		register(get("/users/{id}", MockController, { name: "users.show" }));

		expect(url("users.show", { params: { id: 123 } })).toBe("/users/123");
		expect(url("users.show", { params: { id: "abc" } })).toBe("/users/abc");
	});

	test("generates URL for route with multiple parameters", () => {
		register(
			get("/posts/{postId}/comments/{commentId}", MockController, {
				name: "posts.comments.show",
			}),
		);

		expect(url("posts.comments.show", { params: { postId: 42, commentId: 7 } })).toBe(
			"/posts/42/comments/7",
		);
	});

	test("throws error for non-existent route name", () => {
		register(get("/users", MockController, { name: "users.index" }));

		expect(() => url("non.existent" as any)).toThrow('Route "non.existent" not found');
	});

	test("generates URLs for routes in groups with namePrefix", () => {
		register(
			group({ prefix: "/admin", namePrefix: "admin." }, [
				get("/dashboard", MockController, { name: "dashboard" }),
				get("/users/{id}", MockController, { name: "users.show" }),
			]),
		);

		expect(url("admin.dashboard")).toBe("/admin/dashboard");
		expect(url("admin.users.show", { params: { id: 456 } })).toBe("/admin/users/456");
	});

	test("generates URLs for routes in nested groups", () => {
		const userRoutes = group({ prefix: "/users", namePrefix: "users." }, [
			get("/", MockController, { name: "index" }),
			get("/{id}", MockController, { name: "show" }),
		]);

		const apiRoutes = group({ prefix: "/api", namePrefix: "api." }, [userRoutes]);

		generator.register(apiRoutes);

		expect(url("api.users.index")).toBe("/api/users");
		expect(url("api.users.show", { params: { id: 789 } })).toBe("/api/users/789");
	});

	test("generates protocol-relative URL for routes with static domain", () => {
		register(
			get("/users/{id}", MockController, {
				name: "users.show",
				domain: "api.example.com",
			}),
		);

		expect(url("users.show", { params: { id: 123 } })).toBe("//api.example.com/users/123");
	});

	test("generates protocol-relative URL with domain parameters", () => {
		register(
			get("/users/{id}", MockController, {
				name: "users.show",
				domain: "{account}.example.com",
			}),
		);

		expect(url("users.show", { params: { account: "acme", id: 123 } })).toBe(
			"//acme.example.com/users/123",
		);
	});

	test("uses same param in both domain and path", () => {
		register(
			get("/orgs/{org}/users", MockController, {
				name: "users.index",
				domain: "{org}.example.com",
			}),
		);

		expect(url("users.index", { params: { org: "acme" } })).toBe(
			"//acme.example.com/orgs/acme/users",
		);
	});

	test("wildcard URL generation", () => {
		register(
			get("/files/{...path}", MockController, {
				name: "files.show",
			}),
		);

		expect(url("files.show", { params: { path: "document.pdf" } })).toBe("/files/document.pdf");
		expect(url("files.show", { params: { path: "docs/2024/report.pdf" } })).toBe(
			"/files/docs%2F2024%2Freport.pdf",
		);
	});

	test("wildcard with regular params URL generation", () => {
		register(
			get("/users/{userId}/files/{...path}", MockController, {
				name: "users.files",
			}),
		);

		expect(url("users.files", { params: { userId: 123, path: "photos/pic.jpg" } })).toBe(
			"/users/123/files/photos%2Fpic.jpg",
		);
	});

	test("encodes slashes in parameters", () => {
		register(
			get("/foo/{param}/quux", MockController, {
				name: "test.route",
			}),
		);

		expect(url("test.route", { params: { param: "bar/baz" } })).toBe("/foo/bar%2Fbaz/quux");
	});

	test("encodes special characters in parameters", () => {
		register(
			get("/posts/{postId}/comments/{commentId}", MockController, {
				name: "posts.comments.show",
			}),
		);

		expect(
			url("posts.comments.show", {
				params: {
					postId: "hello world",
					commentId: "foo&bar",
				},
			}),
		).toBe("/posts/hello%20world/comments/foo%26bar");
		expect(
			url("posts.comments.show", {
				params: {
					postId: "test?",
					commentId: "foo#bar",
				},
			}),
		).toBe("/posts/test%3F/comments/foo%23bar");
	});

	test("encodes wildcard parameters", () => {
		register(
			get("/files/{...path}", MockController, {
				name: "files.show",
			}),
		);

		expect(url("files.show", { params: { path: "docs/2024/report.pdf" } })).toBe(
			"/files/docs%2F2024%2Freport.pdf",
		);
	});

	test("encodes domain parameters", () => {
		register(
			get("/users/{id}", MockController, {
				name: "user.show",
				domain: "{tenant}.example.com",
			}),
		);

		expect(url("user.show", { params: { tenant: "hello world", id: 123 } })).toBe(
			"//hello%20world.example.com/users/123",
		);
	});

	test("generates URL for mixed params with prefix", () => {
		register(
			get("/npm/@{scope}/{package}", MockController, {
				name: "npm.package",
			}),
		);

		expect(url("npm.package", { params: { scope: "vue", package: "router" } })).toBe(
			"/npm/@vue/router",
		);
	});

	test("generates URL for mixed params with suffix", () => {
		register(
			get("/files/{id}.txt", MockController, {
				name: "files.text",
			}),
		);

		expect(url("files.text", { params: { id: "123" } })).toBe("/files/123.txt");
	});

	test("generates URL for mixed params with multiple params in segment", () => {
		register(
			get("/files/{id},name={name}.txt", MockController, {
				name: "files.named",
			}),
		);

		expect(url("files.named", { params: { id: "123", name: "report" } })).toBe(
			"/files/123,name=report.txt",
		);
	});

	test("generates URL for mixed params in domain", () => {
		register(
			get("/status", MockController, {
				name: "api.status",
				domain: "api-{version}.example.com",
			}),
		);

		expect(url("api.status", { params: { version: "v2" } })).toBe("//api-v2.example.com/status");
	});

	test("encodes special characters in mixed params", () => {
		register(
			get("/npm/@{scope}/{package}", MockController, {
				name: "npm.package",
			}),
		);

		expect(url("npm.package", { params: { scope: "my scope", package: "pkg&test" } })).toBe(
			"/npm/@my%20scope/pkg%26test",
		);
	});

	test("resource routes with slash-to-dot conversion", () => {
		class TestController extends ResourceController {}

		// Runtime URL generation should work
		register(resource("/admin/photos", TestController));
		expect(url("admin.photos.index")).toBe("/admin/photos");
		expect(url("admin.photos.show", { params: { resourceId: "123" } })).toBe("/admin/photos/123");
	});

	test("resource routes with multiple slashes convert to dots", () => {
		class TestController extends ResourceController {}

		register(resource("/api/v1/users", TestController));
		expect(url("api.v1.users.index")).toBe("/api/v1/users");
		expect(url("api.v1.users.show", { params: { resourceId: "42" } })).toBe("/api/v1/users/42");
	});

	describe("responds to configuration and headers", () => {
		test("uses overrideHost and overrideProtocol from config", () => {
			config.appUrl = {
				overrideHost: "example.com",
				overrideProtocol: "https",
			};

			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: { q: "test" } })).toBe("https://example.com/search?q=test");
		});

		test("protocol precedence: overrideProtocol overrides headers", () => {
			config.appUrl = {
				overrideProtocol: "http",
			};

			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-proto": "https", // Should be overridden
					"x-forwarded-host": "example.com",
				},
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("http://example.com/test");
		});

		test("protocol precedence: headers override defaultProtocol", () => {
			config.appUrl = {
				defaultProtocol: "http", // Default to http
			};

			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-proto": "https", // Should override default
					"x-forwarded-host": "example.com",
				},
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://example.com/test");
		});

		test("protocol precedence: defaultProtocol overrides requestUrl", () => {
			config.appUrl = {
				defaultProtocol: "https",
			};

			const context = mockIntegrationContext({
				requestUrl: "http://example.com/test", // Should be overridden
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://example.com/test");
		});

		test("protocol precedence: requestUrl used as fallback", () => {
			const context = mockIntegrationContext({
				requestUrl: "https://example.com:8443/test",
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://example.com:8443/test");
		});

		test("host precedence: domainPattern overrides all", () => {
			config.appUrl = {
				overrideHost: "config.example.com",
			};

			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-host": "proxy.example.com",
				},
			});

			container.singletonInstance(IntegrationContext, context);

			register(
				get("/test", MockController, {
					name: "test",
					domain: "domain.example.com",
				}),
			);

			// domainPattern should win
			expect(url("test")).toBe("//domain.example.com/test");
		});

		test("host precedence: overrideHost overrides headers", () => {
			config.appUrl = {
				overrideHost: "config.example.com",
				overrideProtocol: "https",
			};

			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-host": "proxy.example.com", // Should be overridden
				},
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://config.example.com/test");
		});

		test("host precedence: headers override defaultHost", () => {
			config.appUrl = {
				defaultHost: "default.example.com",
				overrideProtocol: "https",
			};

			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-host": "proxy.example.com", // Should override default
				},
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://proxy.example.com/test");
		});

		test("host precedence: defaultHost overrides requestUrl", () => {
			config.appUrl = {
				defaultHost: "default.example.com",
				defaultProtocol: "https",
			};

			const context = mockIntegrationContext({
				requestUrl: "http://request.example.com/test", // Should be overridden
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://default.example.com/test");
		});

		test("host precedence: requestUrl used as fallback", () => {
			const context = mockIntegrationContext({
				requestUrl: "https://request.example.com:9000/test",
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://request.example.com:9000/test");
		});

		test("port stripping: removes :80 from http URLs", () => {
			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-proto": "http",
					"x-forwarded-host": "example.com",
					"x-forwarded-port": "80",
				},
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("http://example.com/test");
		});

		test("port stripping: removes :443 from https URLs", () => {
			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-proto": "https",
					"x-forwarded-host": "example.com",
					"x-forwarded-port": "443",
				},
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://example.com/test");
		});

		test("port stripping: preserves non-default ports", () => {
			const context = mockIntegrationContext({
				headers: {
					"x-forwarded-proto": "https",
					"x-forwarded-host": "example.com:8443",
				},
			});

			container.singletonInstance(IntegrationContext, context);

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://example.com:8443/test");
		});

		test("port stripping: works with overrideHost", () => {
			config.appUrl = {
				overrideHost: "example.com:443",
				overrideProtocol: "https",
			};

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("https://example.com/test");
		});

		test("port stripping: works with defaultHost", () => {
			config.appUrl = {
				defaultHost: "example.com:80",
				defaultProtocol: "http",
			};

			register(get("/test", MockController, { name: "test" }));

			expect(url("test")).toBe("http://example.com/test");
		});
	});

	describe("query string handling", () => {
		test("appends query string to route without params", () => {
			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: { q: "test" } })).toBe("/search?q=test");
		});

		test("appends query string to route with params", () => {
			register(get("/users/{id}", MockController, { name: "users.show" }));

			expect(url("users.show", { params: { id: 123 }, query: { tab: "profile" } })).toBe(
				"/users/123?tab=profile",
			);
		});

		test("handles multiple query parameters", () => {
			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: { q: "test", page: 2, limit: 10 } })).toBe(
				"/search?q=test&page=2&limit=10",
			);
		});

		test("handles array values as multiple params", () => {
			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: { tags: ["js", "ts"] } })).toBe("/search?tags=js&tags=ts");
		});

		test("omits null and undefined values", () => {
			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: { q: "test", filter: null, sort: undefined } })).toBe(
				"/search?q=test",
			);
		});

		test("omits null and undefined in arrays", () => {
			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: { tags: ["a", null, "b", undefined, "c"] } })).toBe(
				"/search?tags=a&tags=b&tags=c",
			);
		});

		test("handles URLSearchParams directly", () => {
			register(get("/search", MockController, { name: "search" }));

			const params = new URLSearchParams();
			params.append("q", "test");
			params.append("page", "2");

			expect(url("search", { query: params })).toBe("/search?q=test&page=2");
		});

		test("encodes query parameter keys and values", () => {
			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: { "search query": "hello world" } })).toBe(
				"/search?search+query=hello+world",
			);
		});

		test("works with domain routes", () => {
			register(
				get("/search", MockController, {
					name: "search",
					domain: "api.example.com",
				}),
			);

			expect(url("search", { query: { q: "test" } })).toBe("//api.example.com/search?q=test");
		});

		test("empty query object produces no query string", () => {
			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: {} })).toBe("/search");
		});

		test("query with only null/undefined produces no query string", () => {
			register(get("/search", MockController, { name: "search" }));

			expect(url("search", { query: { a: null, b: undefined } })).toBe("/search");
		});
	});
});
