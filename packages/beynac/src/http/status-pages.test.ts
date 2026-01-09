import { describe, expect, test } from "bun:test";
import { get, group } from "./helpers.ts";
import type { StatusPageComponent } from "./router-types.ts";

const TestErrorPage: StatusPageComponent = () => null;
const Test404Page: StatusPageComponent = () => null;
const Test4xxPage: StatusPageComponent = () => null;
const Test5xxPage: StatusPageComponent = () => null;

describe("status pages validation", () => {
	test("throws on status < 400", () => {
		expect(() => {
			get("/test", () => new Response(), { statusPages: { 200: TestErrorPage } });
		}).toThrowErrorMatchingInlineSnapshot(
			`"Invalid status identifier "200" in statusPages. Must be a number (400-599), "4xx", or "5xx"."`,
		);
	});

	test("throws on status >= 600", () => {
		expect(() => {
			get("/test", () => new Response(), { statusPages: { 600: TestErrorPage } });
		}).toThrowErrorMatchingInlineSnapshot(
			`"Invalid status identifier "600" in statusPages. Must be a number (400-599), "4xx", or "5xx"."`,
		);
	});

	test("accepts 400", () => {
		expect(() => {
			get("/test", () => new Response(), { statusPages: { 400: TestErrorPage } });
		}).not.toThrow();
	});

	test("accepts 599", () => {
		expect(() => {
			get("/test", () => new Response(), { statusPages: { 599: TestErrorPage } });
		}).not.toThrow();
	});

	test("accepts 404", () => {
		expect(() => {
			get("/test", () => new Response(), { statusPages: { 404: Test404Page } });
		}).not.toThrow();
	});

	test("accepts 500", () => {
		expect(() => {
			get("/test", () => new Response(), { statusPages: { 500: TestErrorPage } });
		}).not.toThrow();
	});

	test("accepts '4xx'", () => {
		expect(() => {
			get("/test", () => new Response(), { statusPages: { "4xx": Test4xxPage } });
		}).not.toThrow();
	});

	test("accepts '5xx'", () => {
		expect(() => {
			get("/test", () => new Response(), { statusPages: { "5xx": Test5xxPage } });
		}).not.toThrow();
	});

	test("throws on invalid string identifier", () => {
		expect(() => {
			get("/test", () => new Response(), {
				// oxlint-disable-next-line no-explicit-any -- testing invalid input
				statusPages: { "3xx": TestErrorPage } as any,
			});
		}).toThrow(
			'Invalid status identifier "3xx" in statusPages. Must be a number (400-599), "4xx", or "5xx".',
		);
	});
});

describe("status pages normalization", () => {
	test("simple Record stays as Record", () => {
		const routes = get("/test", () => new Response(), {
			statusPages: { "4xx": TestErrorPage, "5xx": TestErrorPage },
		});

		expect(routes[0].statusPages).toBeTypeOf("object");
		expect("4xx" in routes[0].statusPages!).toBe(true);
		expect("5xx" in routes[0].statusPages!).toBe(true);
		expect(routes[0].statusPages!["4xx"]).toBe(TestErrorPage);
		expect(routes[0].statusPages!["5xx"]).toBe(TestErrorPage);
	});

	test("complex Record stays as Record", () => {
		const routes = get("/test", () => new Response(), {
			statusPages: {
				404: Test404Page,
				"4xx": Test4xxPage,
				"5xx": Test5xxPage,
			},
		});

		expect(routes[0].statusPages).toBeTypeOf("object");
		expect(routes[0].statusPages![404]).toBe(Test404Page);
		expect(routes[0].statusPages!["4xx"]).toBe(Test4xxPage);
		expect(routes[0].statusPages!["5xx"]).toBe(Test5xxPage);
	});

	test("undefined normalises to null", () => {
		const routes = get("/test", () => new Response());

		expect(routes[0].statusPages).toBe(null);
	});
});

describe("status pages group merging", () => {
	test("child overrides parent per-key", () => {
		const ParentPage: StatusPageComponent = () => null;
		const ChildPage: StatusPageComponent = () => null;

		const routes = group(
			{ statusPages: { 404: ParentPage, "4xx": ParentPage, "5xx": ParentPage } },
			[get("/test", () => new Response(), { statusPages: { 404: ChildPage } })],
		);

		expect(routes[0].statusPages?.[404]).toBe(ChildPage);
		expect(routes[0].statusPages?.["4xx"]).toBe(ParentPage);
		expect(routes[0].statusPages?.["5xx"]).toBe(ParentPage);
	});

	test("child inherits parent statusPages", () => {
		const ParentPage: StatusPageComponent = () => null;

		const routes = group({ statusPages: { "4xx": ParentPage, "5xx": ParentPage } }, [
			get("/test", () => new Response()),
		]);

		expect(routes[0].statusPages?.["4xx"]).toBe(ParentPage);
		expect(routes[0].statusPages?.["5xx"]).toBe(ParentPage);
	});

	test("child without statusPages gets parent statusPages", () => {
		const routes = group({ statusPages: { "4xx": TestErrorPage, "5xx": TestErrorPage } }, [
			get("/test", () => new Response()),
		]);

		expect(routes[0].statusPages).not.toBe(null);
		expect(routes[0].statusPages?.["4xx"]).toBe(TestErrorPage);
		expect(routes[0].statusPages?.["5xx"]).toBe(TestErrorPage);
	});

	test("parent without statusPages, child has statusPages", () => {
		const routes = group({}, [
			get("/test", () => new Response(), { statusPages: { 404: Test404Page } }),
		]);

		expect(routes[0].statusPages?.[404]).toBe(Test404Page);
	});
});
