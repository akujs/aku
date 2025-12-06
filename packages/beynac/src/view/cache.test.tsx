/** @jsxImportSource beynac/view */
import { expect, test } from "bun:test";
import { createKey } from "../core/Key.ts";
import { render } from "../test-utils/view-test-utils.bun.ts";
import type { Component } from "./Component.ts";
import { Cache } from "./cache.ts";
import { Once } from "./once.ts";
import { createStack } from "./stack.ts";

test("caches rendered content on first render", async () => {
	const map = new Map<string, string>();
	const result = await render(
		<Cache map={map} key="test">
			<div>Hello World</div>
		</Cache>,
	);

	expect(result).toBe("<div>Hello World</div>");
	expect(map.get("test")).toBe("<div>Hello World</div>");
});

test("returns cached content on subsequent renders", async () => {
	const map = new Map<string, string>();

	// First render
	await render(
		<Cache map={map} key="test">
			<div>Original Content</div>
		</Cache>,
	);

	// Second render with different content (but same key)
	const result = await render(
		<Cache map={map} key="test">
			<div>Different Content</div>
		</Cache>,
	);

	// Should return the cached content, not the new content
	expect(result).toBe("<div>Original Content</div>");
});

test("Stack components work independently inside and outside Cache", async () => {
	const map = new Map<string, string>();
	const TestStack = createStack({ displayName: "TestStack" });

	const result = await render(
		<div>
			<TestStack.Push>Outside push</TestStack.Push>
			<Cache map={map} key="cached">
				<div>
					<TestStack.Push>Inside push</TestStack.Push>
					<TestStack.Out />
				</div>
			</Cache>
			<TestStack.Out />
		</div>,
	);

	expect(result).toBe("<div><div>Inside push</div>Outside push</div>");
});

test("Once components work independently inside and outside Cache", async () => {
	const map = new Map<string, string>();
	const OnceTest = Once.createComponent("test-key");

	const result = await render(
		<div>
			<OnceTest>Outside once</OnceTest>
			<Cache map={map} key="cached">
				<div>
					<OnceTest>Inside once</OnceTest>
				</div>
			</Cache>
			<OnceTest>Outside duplicate</OnceTest>
		</div>,
	);

	expect(result).toBe("<div>Outside once<div>Inside once</div></div>");
});

test("parent context is available in cached content", async () => {
	const map = new Map<string, string>();
	const testKey = createKey<string>();

	const TestComponent: Component = (_, context) => {
		const value = context.get(testKey);
		return <span>{value || "no value"}</span>;
	};

	const ParentComponent: Component = (_, context) => {
		context.set(testKey, "parent value");
		return (
			<div>
				<Cache map={map} key="test">
					<TestComponent />
				</Cache>
			</div>
		);
	};

	const result = await render(<ParentComponent />);

	expect(result).toBe("<div><span>parent value</span></div>");
});
