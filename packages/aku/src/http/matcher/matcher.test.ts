import { describe, expect, test } from "bun:test";
import { addRoute } from "./add-route.ts";
import { createMatcher as _createMatcher } from "./create-matcher.ts";
import { findRoute } from "./find-route.ts";
import type { MatcherContext, Node } from "./types.ts";

type TestRoute = {
	data: { path: string };
	params?: Record<string, string>;
};

type TestRoutes = Record<string, TestRoute | undefined>;

export function createTestRoutes(paths: string[]): Record<string, any> {
	return Object.fromEntries(paths.map((path) => [path, { path }]));
}

function testMatcher(
	routes: string[] | Record<string, any>,
	before?: (matcher: MatcherContext<{ path?: string }>) => void,
	tests?: TestRoutes,
) {
	const matcher = createMatcher<{ path?: string }>(routes);

	if (!tests) {
		tests = Array.isArray(routes)
			? Object.fromEntries(
					routes.map((path) => [
						path,
						{
							data: { path },
						},
					]),
				)
			: Object.fromEntries(
					Object.keys(routes).map((path) => [
						path,
						{
							data: { path },
						},
					]),
				);
	}
	if (before) {
		test("before", () => {
			before(matcher);
		});
	}

	if (!tests) throw new Error("No tests provided");

	for (const path of Object.keys(tests)) {
		test(`lookup ${path} should be ${JSON.stringify(tests[path])}`, () => {
			const expected = tests[path]!;
			const findResult = findRoute(matcher, "GET", path);

			// Handle not found case
			if (expected === undefined) {
				expect(findResult.match, `findRoute(GET, ${path})`).toBeUndefined();
			} else {
				expect(findResult.match, `findRoute(GET, ${path})`).toMatchObject(expected);
			}
		});
	}
}

describe("Matcher lookup", function () {
	describe("domain matching", () => {
		test("static domain with static path", () => {
			const matcher = _createMatcher<{ path: string }>();
			addRoute(matcher, "GET", "/users", { path: "api.example.com/users" }, "api.example.com");
			addRoute(matcher, "GET", "/users", { path: "/users" }); // domain-agnostic fallback

			// Should match domain-specific route
			const match1 = findRoute(matcher, "GET", "/users", "api.example.com");
			expect(match1.match).toMatchObject({ data: { path: "api.example.com/users" } });

			// Should fallback to domain-agnostic route with different domain
			const match2 = findRoute(matcher, "GET", "/users", "other.example.com");
			expect(match2.match).toMatchObject({ data: { path: "/users" } });

			// Should fallback to domain-agnostic route with no hostname
			const match3 = findRoute(matcher, "GET", "/users");
			expect(match3.match).toMatchObject({ data: { path: "/users" } });
		});

		test("domain parameters", () => {
			const matcher = _createMatcher<{ path: string }>();
			addRoute(
				matcher,
				"GET",
				"/dashboard",
				{ path: "{customer}.example.com/dashboard" },
				"{customer}.example.com",
			);

			const match = findRoute(matcher, "GET", "/dashboard", "acme.example.com");
			expect(match.match).toMatchObject({
				data: { path: "{customer}.example.com/dashboard" },
				params: { customer: "acme" },
			});
		});

		test("no ambiguity between domain and path segments", () => {
			const matcher = _createMatcher<{ path: string }>();
			addRoute(matcher, "GET", "/foo", { path: "example.com/foo" }, "example.com");
			addRoute(matcher, "GET", "/example/com/foo", {
				path: "/example/com/foo",
			});

			// Domain route
			const match1 = findRoute(matcher, "GET", "/foo", "example.com");
			expect(match1.match).toMatchObject({ data: { path: "example.com/foo" } });

			// Path route (no domain)
			const match2 = findRoute(matcher, "GET", "/example/com/foo");
			expect(match2.match).toMatchObject({ data: { path: "/example/com/foo" } });

			// Should not confuse the two
			const match3 = findRoute(matcher, "GET", "/example/com/foo", "example.com");
			expect(match3.match).toMatchObject({ data: { path: "/example/com/foo" } });
		});

		test("domain specificity - static before param", () => {
			const matcher = _createMatcher<{ path: string }>();
			addRoute(matcher, "GET", "/users", { path: "api.example.com/users" }, "api.example.com");
			addRoute(
				matcher,
				"GET",
				"/users",
				{ path: "{subdomain}.example.com/users" },
				"{subdomain}.example.com",
			);

			// Static domain should match first
			const match1 = findRoute(matcher, "GET", "/users", "api.example.com");
			expect(match1.match).toMatchObject({ data: { path: "api.example.com/users" } });

			// Param domain should match other subdomains
			const match2 = findRoute(matcher, "GET", "/users", "app.example.com");
			expect(match2.match).toMatchObject({
				data: { path: "{subdomain}.example.com/users" },
				params: { subdomain: "app" },
			});
		});
	});

	describe("static routes", () => {
		testMatcher(["/", "/route", "/another-matcher", "/this/is/yet/another/route"], (matcher) =>
			expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root> ┈> [GET] /
              ├── /route ┈> [GET] /route
              ├── /another-matcher ┈> [GET] /another-matcher
              ├── /this
              │       ├── /is
              │       │       ├── /yet
              │       │       │       ├── /another
              │       │       │       │       ├── /route ┈> [GET] /this/is/yet/another/route"
        `),
		);
	});

	describe("retrieve placeholders", function () {
		testMatcher(
			[
				"/blog/{slug}",
				"/carbon/{element}",
				"/carbon/{element}/test/{testing}",
				"/this/{route}/has/{cool}/stuff",
			],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /blog
              │       ├── /* ┈> [GET] /blog/{slug}
              ├── /carbon
              │       ├── /* ┈> [GET] /carbon/{element}
              │       │       ├── /test
              │       │       │       ├── /* ┈> [GET] /carbon/{element}/test/{testing}
              ├── /this
              │       ├── /*
              │       │       ├── /has
              │       │       │       ├── /*
              │       │       │       │       ├── /stuff ┈> [GET] /this/{route}/has/{cool}/stuff"
        `),
			{
				"/carbon/test1": {
					data: { path: "/carbon/{element}" },
					params: {
						element: "test1",
					},
				},
				"/carbon": undefined,
				"/carbon/": undefined,
				"/carbon/test2/test/test23": {
					data: { path: "/carbon/{element}/test/{testing}" },
					params: {
						element: "test2",
						testing: "test23",
					},
				},
				"/this/test/has/more/stuff": {
					data: { path: "/this/{route}/has/{cool}/stuff" },
					params: {
						route: "test",
						cool: "more",
					},
				},
				"/blog": undefined,
				"/blog/": undefined,
				"/blog/123": {
					data: { path: "/blog/{slug}" },
					params: { slug: "123" },
				},
			},
		);

		testMatcher(
			["/", "/{a}", "/{a}/{y}/{x}/{b}", "/{a}/{x}/{b}", "/{a}/{b}"],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(
					`
          "<root> ┈> [GET] /
              ├── /* ┈> [GET] /{a}
              │       ├── /* ┈> [GET] /{a}/{b}
              │       │       ├── /* ┈> [GET] /{a}/{x}/{b}
              │       │       │       ├── /* ┈> [GET] /{a}/{y}/{x}/{b}"
        `,
				),
			{
				"/": { data: { path: "/" } },
				"/a": {
					data: { path: "/{a}" },
					params: {
						a: "a",
					},
				},
				"/a/b": {
					data: { path: "/{a}/{b}" },
					params: {
						a: "a",
						b: "b",
					},
				},
				"/a/x/b": {
					data: { path: "/{a}/{x}/{b}" },
					params: {
						a: "a",
						b: "b",
						x: "x",
					},
				},
				"/a/y/x/b": {
					data: { path: "/{a}/{y}/{x}/{b}" },
					params: {
						a: "a",
						b: "b",
						x: "x",
						y: "y",
					},
				},
			},
		);

		testMatcher(
			[
				"/",
				"/{packageAndRefOrSha}",
				"/{owner}/{repo}/",
				"/{owner}/{repo}/{packageAndRefOrSha}",
				"/{owner}/{repo}/{npmOrg}/{packageAndRefOrSha}",
			],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(
					`
          "<root> ┈> [GET] /
              ├── /* ┈> [GET] /{packageAndRefOrSha}
              │       ├── /* ┈> [GET] /{owner}/{repo}/
              │       │       ├── /* ┈> [GET] /{owner}/{repo}/{packageAndRefOrSha}
              │       │       │       ├── /* ┈> [GET] /{owner}/{repo}/{npmOrg}/{packageAndRefOrSha}"
        `,
				),
			{
				"/tinylibs/tinybench/tiny@232": {
					data: { path: "/{owner}/{repo}/{packageAndRefOrSha}" },
					params: {
						owner: "tinylibs",
						repo: "tinybench",
						packageAndRefOrSha: "tiny@232",
					},
				},
				"/tinylibs/tinybench/@tinylibs/tiny@232": {
					data: { path: "/{owner}/{repo}/{npmOrg}/{packageAndRefOrSha}" },
					params: {
						owner: "tinylibs",
						repo: "tinybench",
						npmOrg: "@tinylibs",
						packageAndRefOrSha: "tiny@232",
					},
				},
			},
		);
	});

	describe("should be able to perform wildcard lookups", () => {
		testMatcher(
			["/polymer/{...id}", "/polymer/another/route", "/route/{p1}/something/{...rest}"],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /polymer
              │       ├── /another
              │       │       ├── /route ┈> [GET] /polymer/another/route
              │       ├── /** ┈> [GET] /polymer/{...id}
              ├── /route
              │       ├── /*
              │       │       ├── /something
              │       │       │       ├── /** ┈> [GET] /route/{p1}/something/{...rest}"
        `),
			{
				"/polymer/another/route": { data: { path: "/polymer/another/route" } },
				"/polymer/anon": {
					data: { path: "/polymer/{...id}" },
					params: { id: "anon" },
				},
				"/polymer/foo/bar/baz": {
					data: { path: "/polymer/{...id}" },
					params: { id: "foo/bar/baz" },
				},
				"/route/param1/something/c/d": {
					data: { path: "/route/{p1}/something/{...rest}" },
					params: { p1: "param1", rest: "c/d" },
				},
			},
		);
	});

	describe("fallback to dynamic", () => {
		testMatcher(
			["/wildcard/{...wildcard}", "/test/{...wildcard}", "/test", "/dynamic/{...path}"],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /wildcard
              │       ├── /** ┈> [GET] /wildcard/{...wildcard}
              ├── /test ┈> [GET] /test
              │       ├── /** ┈> [GET] /test/{...wildcard}
              ├── /dynamic
              │       ├── /** ┈> [GET] /dynamic/{...path}"
        `),
			{
				"/wildcard": {
					data: { path: "/wildcard/{...wildcard}" },
				},
				"/wildcard/": {
					data: { path: "/wildcard/{...wildcard}" },
				},
				"/wildcard/abc": {
					data: { path: "/wildcard/{...wildcard}" },
					params: { wildcard: "abc" },
				},
				"/wildcard/abc/def": {
					data: { path: "/wildcard/{...wildcard}" },
					params: { wildcard: "abc/def" },
				},
				"/dynamic": {
					data: { path: "/dynamic/{...path}" },
					params: { path: "" },
				},
				"/test": {
					data: { path: "/test" },
				},
				"/test/": {
					data: { path: "/test" },
				},
				"/test/abc": {
					data: { path: "/test/{...wildcard}" },
					params: { wildcard: "abc" },
				},
			},
		);
	});

	describe("unnamed placeholders", function () {
		testMatcher(
			["/polymer/{...wildcard}", "/polymer/route/{segment}"],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /polymer
              │       ├── /route
              │       │       ├── /* ┈> [GET] /polymer/route/{segment}
              │       ├── /** ┈> [GET] /polymer/{...wildcard}"
        `),
			{
				"/polymer/foo/bar": {
					data: { path: "/polymer/{...wildcard}" },
					params: { wildcard: "foo/bar" },
				},
				"/polymer/route/anon": {
					data: { path: "/polymer/route/{segment}" },
					params: { segment: "anon" },
				},
				"/polymer/constructor": {
					data: { path: "/polymer/{...wildcard}" },
					params: { wildcard: "constructor" },
				},
			},
		);
	});

	describe("mixed params in same segment", function () {
		const mixedPath = "/files/{category}/{id},name={name}.txt";
		testMatcher(
			[mixedPath],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /files
              │       ├── /*
              │       │       ├── /* ┈> [GET] /files/{category}/{id},name={name}.txt"
        `),
			{
				"/files/test/123,name=foobar.txt": {
					data: { path: mixedPath },
					params: { category: "test", id: "123", name: "foobar" },
				},
				"/files/test": undefined,
			},
		);

		testMatcher(
			["/npm/{param1}/{param2}", "/npm/@{param1}/{param2}"],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /npm
              │       ├── /*
              │       │       ├── /* ┈> [GET] /npm/{param1}/{param2} + /npm/@{param1}/{param2}"
        `),
			{
				"/npm/@test/123": {
					data: { path: "/npm/@{param1}/{param2}" },
					params: { param1: "test", param2: "123" },
				},
				"/npm/test/123": {
					data: { path: "/npm/{param1}/{param2}" },
					params: { param1: "test", param2: "123" },
				},
			},
		);

		testMatcher(
			["/npm/@{param1}/{param2}"],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /npm
              │       ├── /*
              │       │       ├── /* ┈> [GET] /npm/@{param1}/{param2}"
        `),
			{
				"/npm/@test/123": {
					data: { path: "/npm/@{param1}/{param2}" },
					params: { param1: "test", param2: "123" },
				},
				"/npm/test/123": undefined,
			},
		);
	});

	describe("should be able to match routes with trailing slash", function () {
		testMatcher(
			["/route/without/trailing/slash", "/route/with/trailing/slash/"],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /route
              │       ├── /without
              │       │       ├── /trailing
              │       │       │       ├── /slash ┈> [GET] /route/without/trailing/slash
              │       ├── /with
              │       │       ├── /trailing
              │       │       │       ├── /slash ┈> [GET] /route/with/trailing/slash/"
        `),
			{
				"/route/without/trailing/slash": {
					data: { path: "/route/without/trailing/slash" },
				},
				"/route/with/trailing/slash/": {
					data: { path: "/route/with/trailing/slash/" },
				},
				"/route/without/trailing/slash/": {
					data: { path: "/route/without/trailing/slash" },
				},
				"/route/with/trailing/slash": {
					data: { path: "/route/with/trailing/slash/" },
				},
			},
		);
	});

	describe("empty segments", function () {
		testMatcher(
			["/test//route", "/test/{param}/route"],
			(matcher) =>
				expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
          "<root>
              ├── /test
              │       ├── <empty>
              │       │       ├── /route ┈> [GET] /test//route
              │       ├── /*
              │       │       ├── /route ┈> [GET] /test/{param}/route"
        `),
			{
				"/test//route": {
					data: { path: "/test//route" },
				},
				"/test/id/route": {
					data: { path: "/test/{param}/route" },
				},
			},
		);
	});
});

describe("Matcher insert", () => {
	test("should be able to insert nodes correctly into the tree", () => {
		const matcher = createMatcher([
			"/hello",
			"/cool",
			"/hi",
			"/helium",
			"/choo",
			"/coooool",
			"/chrome",
			"/choot",
			"/choot/{choo}",
			"/ui/{...wildcard}",
			"/ui/components/{...wildcard}",
			"/api/v1",
			"/api/v2",
			"/api/v3",
		]);

		addRoute(matcher, "", "/api/v3", {
			path: "/api/v3(overridden)",
		});

		expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
      "<root>
          ├── /hello ┈> [GET] /hello
          ├── /cool ┈> [GET] /cool
          ├── /hi ┈> [GET] /hi
          ├── /helium ┈> [GET] /helium
          ├── /choo ┈> [GET] /choo
          ├── /coooool ┈> [GET] /coooool
          ├── /chrome ┈> [GET] /chrome
          ├── /choot ┈> [GET] /choot
          │       ├── /* ┈> [GET] /choot/{choo}
          ├── /ui
          │       ├── /components
          │       │       ├── /** ┈> [GET] /ui/components/{...wildcard}
          │       ├── /** ┈> [GET] /ui/{...wildcard}
          ├── /api
          │       ├── /v1 ┈> [GET] /api/v1
          │       ├── /v2 ┈> [GET] /api/v2
          │       ├── /v3 ┈> [GET] /api/v3, [*] /api/v3(overridden)"
    `);
	});
});

describe("route matching", () => {
	const matcher = createMatcher([
		"/test",
		"/test/{id}",
		"/test/{idYZ}/y/z",
		"/test/{idY}/y",
		"/test/foo",
		"/test/foo/{segment}",
		"/test/foo/{...wildcard}",
		"/test/foo/bar/qux",
		"/test/foo/baz",
		"/test/fooo",
		"/another/path",
		"/wildcard/{...wildcard}",
	]);

	test("snapshot", () => {
		expect(formatTree(matcher.root)).toMatchInlineSnapshot(`
      "<root>
          ├── /test ┈> [GET] /test
          │       ├── /foo ┈> [GET] /test/foo
          │       │       ├── /bar
          │       │       │       ├── /qux ┈> [GET] /test/foo/bar/qux
          │       │       ├── /baz ┈> [GET] /test/foo/baz
          │       │       ├── /* ┈> [GET] /test/foo/{segment}
          │       │       ├── /** ┈> [GET] /test/foo/{...wildcard}
          │       ├── /fooo ┈> [GET] /test/fooo
          │       ├── /* ┈> [GET] /test/{id}
          │       │       ├── /y ┈> [GET] /test/{idY}/y
          │       │       │       ├── /z ┈> [GET] /test/{idYZ}/y/z
          ├── /another
          │       ├── /path ┈> [GET] /another/path
          ├── /wildcard
          │       ├── /** ┈> [GET] /wildcard/{...wildcard}"
    `);
	});

	test("match routes", () => {
		// Static
		const r1 = findRoute(matcher, "GET", "/test");
		expect(r1.match).toMatchObject({ data: { path: "/test" } });

		const r2 = findRoute(matcher, "GET", "/test/foo");
		expect(r2.match).toMatchObject({ data: { path: "/test/foo" } });

		const r3 = findRoute(matcher, "GET", "/test/fooo");
		expect(r3.match).toMatchObject({ data: { path: "/test/fooo" } });

		const r4 = findRoute(matcher, "GET", "/another/path");
		expect(r4.match).toMatchObject({ data: { path: "/another/path" } });

		// Param
		const r5 = findRoute(matcher, "GET", "/test/123");
		expect(r5.match).toMatchObject({ data: { path: "/test/{id}" }, params: { id: "123" } });

		const r6 = findRoute(matcher, "GET", "/test/123/y");
		expect(r6.match).toMatchObject({ data: { path: "/test/{idY}/y" }, params: { idY: "123" } });

		const r7 = findRoute(matcher, "GET", "/test/123/y/z");
		expect(r7.match).toMatchObject({
			data: { path: "/test/{idYZ}/y/z" },
			params: { idYZ: "123" },
		});

		const r8 = findRoute(matcher, "GET", "/test/foo/123");
		expect(r8.match).toMatchObject({
			data: { path: "/test/foo/{segment}" },
			params: { segment: "123" },
		});

		// Wildcard
		const r9 = findRoute(matcher, "GET", "/test/foo/123/456");
		expect(r9.match).toMatchObject({
			data: { path: "/test/foo/{...wildcard}" },
			params: { wildcard: "123/456" },
		});

		const r10 = findRoute(matcher, "GET", "/wildcard/foo");
		expect(r10.match).toMatchObject({
			data: { path: "/wildcard/{...wildcard}" },
			params: { wildcard: "foo" },
		});

		const r11 = findRoute(matcher, "GET", "/wildcard/foo/bar");
		expect(r11.match).toMatchObject({
			data: { path: "/wildcard/{...wildcard}" },
			params: { wildcard: "foo/bar" },
		});

		const r12 = findRoute(matcher, "GET", "/wildcard");
		expect(r12.match).toMatchObject({
			data: { path: "/wildcard/{...wildcard}" },
			params: { wildcard: "" },
		});
	});

	test("method mismatch detection", () => {
		const matcher = _createMatcher<{ path: string }>();
		addRoute(matcher, "GET", "/users", { path: "GET /users" });
		addRoute(matcher, "POST", "/users", { path: "POST /users" });
		addRoute(matcher, "GET", "/posts/{id}", { path: "GET /posts/{id}" });
		addRoute(matcher, "GET", "/wildcard/{...rest}", { path: "GET /wildcard/{...rest}" });

		// Exact match - should find
		const match1 = findRoute(matcher, "GET", "/users");
		expect(match1.match).toMatchObject({ data: { path: "GET /users" } });

		// Wrong method on existing path - should set methodMismatch
		const match2 = findRoute(matcher, "DELETE", "/users");
		expect(match2).toEqual({ methodMismatch: true });

		// Path doesn't exist - should not set methodMismatch
		const match3 = findRoute(matcher, "GET", "/nonexistent");
		expect(match3).toEqual({});

		// Method mismatch with params
		const match4 = findRoute(matcher, "POST", "/posts/123");
		expect(match4).toEqual({ methodMismatch: true });

		// Method mismatch with wildcard
		const match5 = findRoute(matcher, "POST", "/wildcard/foo/bar");
		expect(match5).toEqual({ methodMismatch: true });
	});

	test("method mismatch with domain routes", () => {
		const matcher = _createMatcher<{ path: string }>();
		addRoute(matcher, "GET", "/api", { path: "GET api.example.com/api" }, "api.example.com");

		// Wrong method on domain route
		const match = findRoute(matcher, "POST", "/api", "api.example.com");
		expect(match).toEqual({ methodMismatch: true });
	});

	describe("static cache usage", () => {
		test("uses static cache for domain-agnostic routes", () => {
			const matcher = _createMatcher<{ path: string }>();
			addRoute(matcher, "GET", "/users", { path: "GET /users" });

			const result = findRoute(matcher, "GET", "/users");
			expect(result.match).toBeDefined();
			expect(result.static).toBe(true);
		});

		test("uses static cache for domain-specific routes", () => {
			const matcher = _createMatcher<{ path: string }>();
			addRoute(matcher, "GET", "/api", { path: "GET api.example.com/api" }, "api.example.com");

			const result = findRoute(matcher, "GET", "/api", "api.example.com");
			expect(result.match).toBeDefined();
			expect(result.static).toBe(true);
		});

		test("does not use static cache for parameterized routes", () => {
			const matcher = _createMatcher<{ path: string }>();
			addRoute(matcher, "GET", "/users/{id}", { path: "GET /users/{id}" });

			const result = findRoute(matcher, "GET", "/users/123");
			expect(result.match).toBeDefined();
			expect(result.static).toBeUndefined();
		});

		test("does not use static cache for domain routes with params", () => {
			const matcher = _createMatcher<{ path: string }>();
			addRoute(
				matcher,
				"GET",
				"/users/{id}",
				{ path: "GET api.example.com/users/{id}" },
				"api.example.com",
			);

			const result = findRoute(matcher, "GET", "/users/123", "api.example.com");
			expect(result.match).toBeDefined();
			expect(result.static).toBeUndefined();
		});
	});
});

export function createMatcher<T extends Record<string, string> = Record<string, string>>(
	routes: string[] | Record<string, T>,
): MatcherContext<T> {
	const matcher = _createMatcher<T>();
	if (Array.isArray(routes)) {
		for (const route of routes) {
			addRoute(matcher, "GET", route, { path: route } as unknown as T);
		}
	} else {
		for (const [route, data] of Object.entries(routes)) {
			addRoute(matcher, "GET", route, data);
		}
	}
	return matcher;
}

function formatTree(
	node: Node<{ path?: string }>,
	depth = 0,
	result = [] as string[],
	prefix = "",
): string | string[] {
	result.push(
		`${prefix}${depth === 0 ? "" : "├── "}${node.key ? `/${node.key}` : depth === 0 ? "<root>" : "<empty>"}${_formatMethods(node)}`,
	);

	const childrenArray = [...Object.values(node.static || []), node.param, node.wildcard].filter(
		Boolean,
	) as Node<{
		path?: string;
	}>[];
	for (const [index, child] of childrenArray.entries()) {
		const lastChild = index === childrenArray.length - 1;
		formatTree(
			child,
			depth + 1,
			result,
			(depth === 0 ? "" : prefix + (depth > 0 ? "│   " : "    ")) + (lastChild ? "    " : "    "),
		);
	}

	return depth === 0 ? result.join("\n") : result;
}

function _formatMethods(node: Node<{ path?: string }>) {
	if (!node.methods) {
		return "";
	}
	return ` ┈> ${Object.entries(node.methods)
		.map(([method, arr]) => {
			const val = arr?.map((d) => d?.data?.path || JSON.stringify(d?.data)).join(" + ") || "";
			return `[${method || "*"}] ${val}`;
		})
		.join(", ")}`;
}
