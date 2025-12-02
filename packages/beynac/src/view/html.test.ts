import { describe, expect, test } from "bun:test";
import { render } from "../test-utils/view-test-utils.ts";
import { html } from "./html.ts";
import { raw } from "./raw.ts";

describe("html template literal", () => {
	describe("basic functionality", () => {
		test("renders simple HTML template", async () => {
			const result = html`<div>Hello World</div>`;
			expect(await render(result)).toBe("<div>Hello World</div>");
		});

		test("gives type error on invalid interpolation", () => {
			// @ts-expect-error asserting error for test
			void html`<div>${Symbol()}</div>`;
		});

		test("interpolates values", async () => {
			const name = "Alice";
			const result = html`<div>Hello ${name}</div>`;
			expect(await render(result)).toBe("<div>Hello Alice</div>");
		});

		test("handles multiple interpolations", async () => {
			const result = html`<div>${"hello"} ${" "} ${"world"}</div>`;
			expect(await render(result)).toBe("<div>hello   world</div>");
		});

		test("interpolates numbers", async () => {
			const result = html`<span>Count: ${42}</span>`;
			expect(await render(result)).toBe("<span>Count: 42</span>");
		});

		test("escapes interpolated strings by default", async () => {
			const dangerous = "<script>alert('xss')</script>";
			const result = html`<div>${dangerous}</div>`;
			expect(await render(result)).toBe("<div>&lt;script&gt;alert('xss')&lt;/script&gt;</div>");
		});
	});

	describe("raw content", () => {
		test("preserves raw content", async () => {
			const result = html`<div>${raw("<b>bold</b>")}</div>`;
			expect(await render(result)).toBe("<div><b>bold</b></div>");
		});
	});

	describe("async support", () => {
		test("handles promise interpolation", async () => {
			const result = html`<div>${Promise.resolve("async content")}</div>`;
			const rendered = await render(result);
			expect(rendered).toBe("<div>async content</div>");
		});

		test("handles multiple async values", async () => {
			// prettier-ignore
			const result = html`<div>${Promise.resolve("first")} ${Promise.resolve("second")}</div>`;
			const rendered = await render(result);
			expect(rendered).toBe("<div>first second</div>");
		});
	});

	describe("edge cases", () => {
		test("handles null and undefined", async () => {
			const result = html`<div>${null} ${undefined}</div>`;
			expect(await render(result)).toBe("<div> </div>");
		});

		test("skips boolean values", async () => {
			const result = html`<div>${true} ${false}</div>`;
			expect(await render(result)).toBe("<div> </div>");
		});

		test("handles empty template", async () => {
			const result = html``;
			expect(await render(result)).toBe("");
		});

		test("handles nested html templates", async () => {
			const inner = html`<span>inner</span>`;
			const result = html`<div>${inner}</div>`;
			expect(await render(result)).toBe("<div><span>inner</span></div>");
		});
	});
});
