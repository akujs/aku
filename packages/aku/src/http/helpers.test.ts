import { describe, expect, expectTypeOf, test } from "bun:test";
import { get, group } from "./helpers.ts";
import type { Routes } from "./router-types.ts";

test("type inference for named routes", () => {
	// Type inference only works when name is set at creation time
	const route2 = get("/posts", MockController, { name: "posts.index" });

	expectTypeOf(route2).toEqualTypeOf<Routes<{ "posts.index": never }>>();
});

test("applies namePrefix to route names", () => {
	const routes = group({ namePrefix: "admin." }, [
		get("/dashboard", MockController, { name: "dashboard" }),
		get("/users", MockController, { name: "users" }),
	]);

	expectTypeOf(routes).toEqualTypeOf<Routes<{ "admin.dashboard": never; "admin.users": never }>>();
});

test("throws error when child route has different domain than parent group", () => {
	expect(() => {
		group({ domain: "api.example.com" }, [
			get("/users", MockController, { domain: "admin.example.com" }),
		]);
	}).toThrow(/Domain conflict/);
});

test("allows same domain on parent group and child route", () => {
	expect(() => {
		group({ domain: "api.example.com" }, [
			get("/users", MockController, { domain: "api.example.com" }),
		]);
	}).not.toThrow();
});

test("allows child without domain when parent has domain", () => {
	expect(() => {
		group({ domain: "api.example.com" }, [get("/users", MockController)]);
	}).not.toThrow();
});

test("group without options parameter", () => {
	const routes = group([get("/dashboard/{page}", MockController, { name: "dashboard" })]);

	// Verify it creates a valid Routes object
	expect(routes).toHaveLength(1);
	expect(routes[0].path).toBe("/dashboard/{page}");
	expect(routes[0].routeName).toBe("dashboard");

	// Type inference should work
	expectTypeOf(routes).toEqualTypeOf<Routes<{ dashboard: "page" }>>();
});

test("strips trailing slash from group prefix", () => {
	const routes = group({ prefix: "/api/" }, [get("/users", MockController)]);
	expect(routes[0].path).toBe("/api/users");
});

describe("wildcard routes", () => {
	test("type inference for named wildcards", () => {
		const route = get("/files/{...path}", MockController, { name: "files" });

		// Should infer "path" param name
		expectTypeOf(route).toEqualTypeOf<Routes<{ files: "path" }>>();
	});

	test("type inference for wildcard with regular params", () => {
		const route = get("/users/{userId}/files/{...path}", MockController, {
			name: "users.files",
		});

		// Should infer both param names
		expectTypeOf(route).toEqualTypeOf<Routes<{ "users.files": "userId" | "path" }>>();
	});
});

describe("validation", () => {
	function expectPathToThrow(path: string, messageContains?: string) {
		const fn = () => get(path, MockController);
		expect(fn).toThrow(messageContains);
	}

	function expectDomainToThrow(domain: string, messageContains?: string) {
		const fn = () => get("/users", MockController, { domain });
		expect(fn).toThrow(messageContains);
	}

	test("rejects asterisk characters in paths", () => {
		expectPathToThrow(
			"/api/**",
			'Route path "/api/**" contains asterisk characters. Use {...param} for wildcard routes instead of ** or *.',
		);
	});

	test("rejects invalid curly brace patterns", () => {
		expectPathToThrow("/{param", 'Route path "/{param" contains invalid curly braces');

		expectPathToThrow("/param}", 'Route path "/param}" contains invalid curly braces');

		expectPathToThrow(
			"/foo/}{param}/",
			'Route path "/foo/}{param}/" contains invalid curly braces',
		);

		expectPathToThrow("/{{param}}", 'Route path "/{{param}}" contains invalid curly braces');

		expectPathToThrow("/foo/{}/bar", 'Route path "/foo/{}/bar" contains invalid curly braces');

		expectPathToThrow("/{ param}", 'Route path "/{ param}" contains invalid curly braces');

		expectPathToThrow(
			"/foo/{param}/bar/}",
			'Route path "/foo/{param}/bar/}" contains invalid curly braces',
		);

		expectPathToThrow("/{...param", 'Route path "/{...param" contains invalid curly braces');

		expectDomainToThrow(
			"{tenant.example.com",
			'Route path "{tenant.example.com" contains invalid curly braces',
		);

		expectDomainToThrow(
			"tenant}.example.com",
			'Route path "tenant}.example.com" contains invalid curly braces',
		);
	});

	test("rejects route paths not starting with slash", () => {
		expectPathToThrow("foo", 'Route path "foo" must start with "/"');
	});

	test("rejects group prefix not starting with slash", () => {
		expect(() => {
			group({ prefix: "api" }, [get("/users", MockController)]);
		}).toThrow('Group prefix "api" must start with "/".');
	});

	test("rejects wildcard in middle of path", () => {
		expectPathToThrow(
			"/foo/{...params}/bar",
			'Route path "/foo/{...params}/bar" has wildcard parameter in non-terminal position',
		);
	});

	test("rejects wildcard before parameter", () => {
		expectPathToThrow(
			"/foo/{...params}/{id}",
			'Route path "/foo/{...params}/{id}" has wildcard parameter in non-terminal position',
		);
	});

	test("rejects wildcard in group prefix", () => {
		expect(() => {
			group({ prefix: "/files/{...path}" }, [get("/", MockController)]);
		}).toThrow(
			'Group prefix "/files/{...path}" contains a wildcard parameter. Wildcards are not allowed in group prefixes',
		);
	});

	test("rejects wildcard at start of domain", () => {
		expectDomainToThrow(
			"{...tenant}.example.com",
			'Domain "{...tenant}.example.com" contains a wildcard parameter. Wildcards are not allowed in domains',
		);
	});

	test("rejects wildcard in middle of domain", () => {
		expectDomainToThrow(
			"{tenant}.{...path}.example.com",
			'Domain "{tenant}.{...path}.example.com" contains a wildcard parameter. Wildcards are not allowed in domains',
		);
	});

	test("rejects wildcard at end of domain", () => {
		expectDomainToThrow(
			"example.{...path}",
			'Domain "example.{...path}" contains a wildcard parameter. Wildcards are not allowed in domains',
		);
	});

	test("rejects wildcard in group domain", () => {
		expect(() => {
			group({ domain: "{...tenant}.example.com" }, [get("/users", MockController)]);
		}).toThrow(
			'Domain "{...tenant}.example.com" contains a wildcard parameter. Wildcards are not allowed in domains',
		);
	});

	test("allows valid parameter syntax", () => {
		expect(() => {
			get("/users/{id}", MockController);
		}).not.toThrow();

		expect(() => {
			get("/files/{...path}", MockController);
		}).not.toThrow();

		expect(() => {
			get("/users", MockController, { domain: "{tenant}.example.com" });
		}).not.toThrow();
	});
});

import { MockController } from "../test-utils/http-test-utils.bun.ts";
import { resource } from "./helpers.ts";
import { ResourceController } from "./ResourceController.ts";

describe("resource routes", () => {
	test("resource() creates routes that work with RouteUrlGenerator", () => {
		class PhotoController extends ResourceController {}

		const routes = resource("/photos", PhotoController);
		expect(routes).toHaveLength(7);

		const routeNames = routes.map((r) => r.routeName).filter(Boolean);
		expect(routeNames).toContain("photos.index");
		expect(routeNames).toContain("photos.show");
	});
});

describe("meta field", () => {
	test("passes meta to route definition", () => {
		const routes = get("/users", MockController, { meta: { foo: "bar" } });
		expect(routes[0].meta).toEqual({ foo: "bar" });
	});

	test("merges meta from group to child routes", () => {
		const routes = group({ meta: { level: "group" } }, [
			get("/users", MockController, { meta: { route: "users" } }),
		]);

		expect(routes[0].meta).toEqual({ level: "group", route: "users" });
	});

	test("child meta overrides parent meta", () => {
		const routes = group({ meta: { shared: "parent", override: "parent" } }, [
			get("/users", MockController, { meta: { override: "child" } }),
		]);

		expect(routes[0].meta).toEqual({ shared: "parent", override: "child" });
	});

	test("resource routes have meta.action set", () => {
		const routes = resource("/photos", MockController);

		const indexRoute = routes.find((r) => r.routeName === "photos.index");
		expect(indexRoute?.meta).toEqual({ action: "index" });

		const showRoute = routes.find((r) => r.routeName === "photos.show");
		expect(showRoute?.meta).toEqual({ action: "show" });
	});

	test("resource routes can merge additional meta", () => {
		const routes = resource("/photos", MockController, {
			meta: { auth: true },
		});

		const indexRoute = routes.find((r) => r.routeName === "photos.index");
		expect(indexRoute?.meta).toEqual({ auth: true, action: "index" });
	});
});
