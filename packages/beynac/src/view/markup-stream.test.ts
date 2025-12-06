import { describe, expect, test } from "bun:test";
import { createKey } from "../core/Key.ts";
import { asyncGate } from "../test-utils/async-gate.bun.ts";
import { render, renderResponse, renderStream } from "../test-utils/view-test-utils.bun.ts";
import { MarkupStream } from "./markup-stream.ts";
import { RenderingError } from "./view-errors.ts";
import type { Context, JSXNode } from "./view-types.ts";

describe("basic functionality", () => {
	test("renders empty content", async () => {
		const emptyStream = new MarkupStream(null, null, null);
		expect(await render(emptyStream)).toBe("");

		const emptyTag = new MarkupStream("br", null, null);
		expect(await render(emptyTag)).toBe("<br>");
	});

	test("renders text content", async () => {
		const plainText = new MarkupStream(null, null, ["Hello World"]);
		expect(await render(plainText)).toBe("Hello World");

		const taggedText = new MarkupStream("div", null, ["Hello"]);
		expect(await render(taggedText)).toBe("<div>Hello</div>");
	});

	test("renders tag with attributes", async () => {
		const stream = new MarkupStream("div", { id: "test", class: "container" }, ["Content"]);
		expect(await render(stream)).toBe('<div id="test" class="container">Content</div>');
	});

	test("renders numbers", async () => {
		const stream = new MarkupStream(null, null, [42, " is the answer"]);
		expect(await render(stream)).toBe("42 is the answer");
	});

	test("skips null, undefined, and boolean values", async () => {
		const stream = new MarkupStream(null, null, ["start", null, undefined, true, false, "end"]);
		expect(await render(stream)).toBe("startend");
	});

	test("renders nested arrays", async () => {
		const stream = new MarkupStream(null, null, ["a", ["b", ["c", "d"], "e"], "f"]);
		const chunks = await Array.fromAsync(renderStream(stream));
		// All synchronous content should be in a single chunk
		expect(chunks).toEqual(["abcdef"]);
	});

	test("renders arrays with mixed async content", async () => {
		const stream = new MarkupStream(null, null, [
			["a", Promise.resolve("b")],
			[Promise.resolve(["c", "d"] as JSXNode[])],
		]);

		const result = await render(stream);
		expect(result).toBe("abcd");
	});

	test("renders empty arrays at various nesting levels", async () => {
		const stream = new MarkupStream(null, null, ["a", [], ["b", [], "c"], [[], [[]]], "d"]);
		expect(await render(stream)).toBe("abcd");
	});

	test("renders arrays with all skippable values", async () => {
		const stream = new MarkupStream(null, null, [
			"start",
			[null, undefined, true, false],
			[[null], [undefined, [true, false]]],
			"end",
		]);
		expect(await render(stream)).toBe("startend");
	});

	test("renders promises resolving to nested arrays", async () => {
		const stream = new MarkupStream(null, null, [
			"before ",
			Promise.resolve(["a", ["b", "c"]] as JSXNode[]),
			" after",
		]);

		const chunks = await Array.fromAsync(renderStream(stream));
		// First chunk: sync content before promise
		// Second chunk: resolved promise content + remaining sync content
		expect(chunks).toEqual(["before ", "abc after"]);
	});

	test("renders nested MarkupStreams", async () => {
		const inner = new MarkupStream("span", { id: "inner" }, ["inner"]);
		const outer = new MarkupStream("div", { id: "outer" }, ["before ", inner, " after"]);
		const chunks = await Array.fromAsync(renderStream(outer));
		// All synchronous nested content in a single chunk
		expect(chunks).toEqual(['<div id="outer">before <span id="inner">inner</span> after</div>']);
	});
});

describe("attribute handling", () => {
	test("handles boolean attributes in HTML mode", async () => {
		const stream = new MarkupStream("input", { disabled: true, hidden: false, checked: true }, []);
		expect(await render(stream)).toBe("<input disabled checked>");
	});

	test("skips null and undefined attributes", async () => {
		const stream = new MarkupStream(
			"div",
			{
				id: "test",
				nullAttr: null,
				undefinedAttr: undefined,
			},
			[],
		);
		expect(await render(stream)).toBe('<div id="test"></div>');
	});

	test("throws error for function attributes", async () => {
		const stream = new MarkupStream(
			"div",
			{
				funcAttr: function foo() {},
			},
			[],
		);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain('Attribute "funcAttr" has an invalid value type: Function');
			expect(err.errorKind).toBe("attribute-type-error");
			expect(err.componentStack).toEqual(["div"]);
		}
	});

	test("throws error for symbol attributes", async () => {
		const stream = new MarkupStream(
			"div",
			{
				symAttr: Symbol("test"),
			},
			[],
		);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain('Attribute "symAttr" has an invalid value type: Symbol');
			expect(err.errorKind).toBe("attribute-type-error");
			expect(err.componentStack).toEqual(["div"]);
		}
	});

	test("throws error for promise attributes", async () => {
		const stream = new MarkupStream(
			"div",
			{
				promiseAttr: Promise.resolve("test"),
			},
			[],
		);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain('Attribute "promiseAttr" has an invalid value type: Promise');
			expect(err.errorKind).toBe("attribute-type-error");
			expect(err.componentStack).toEqual(["div"]);
		}
	});

	test("escapes attribute values", async () => {
		const stream = new MarkupStream(
			"div",
			{
				title: 'Test "quotes" & <brackets>',
				"data-value": "It's a test",
			},
			[],
		);
		expect(await render(stream)).toBe(
			`<div title="Test &quot;quotes&quot; &amp; &lt;brackets&gt;" data-value="It's a test"></div>`,
		);
	});

	test("escapes attribute values", async () => {
		const stream = new MarkupStream(
			"div",
			{
				title: 'Test "quotes" & <brackets>',
				"data-value": "It's a test",
			},
			[],
		);
		expect(await render(stream)).toBe(
			`<div title="Test &quot;quotes&quot; &amp; &lt;brackets&gt;" data-value="It's a test"></div>`,
		);
	});

	test("escapes content", async () => {
		const stream = new MarkupStream("div", null, [`I'm a little <teapot> "short" & stout`]);
		expect(await render(stream)).toBe(
			`<div>I'm a little &lt;teapot&gt; &quot;short&quot; &amp; stout</div>`,
		);
	});
});

describe("async functionality", () => {
	test("renders async string", async () => {
		const stream = new MarkupStream(null, null, ["sync ", Promise.resolve("async"), " end"]);

		const chunks = await Array.fromAsync(renderStream(stream));
		// First chunk: content before promise
		// Second chunk: resolved promise + remaining content
		expect(chunks).toEqual(["sync ", "async end"]);
	});

	test("renders async children array", async () => {
		const stream = new MarkupStream("div", null, Promise.resolve(["Hello ", "World"]));

		// The promise is now wrapped as content
		expect(stream.content).not.toBeNull();
		expect(stream.content?.length).toBe(1);
		expect(stream.content?.[0]).toBeInstanceOf(Promise);

		const chunks = await Array.fromAsync(renderStream(stream));
		// First chunk: opening tag
		// Second chunk: resolved content + closing tag
		expect(chunks).toEqual(["<div>", "Hello World</div>"]);
	});

	test("renders async MarkupStream", async () => {
		const asyncInner = Promise.resolve(new MarkupStream("span", null, ["async content"]));
		const stream = new MarkupStream("div", null, ["before ", asyncInner, " after"]);

		const chunks = await Array.fromAsync(renderStream(stream));
		// First chunk: opening tag + content before promise
		// Second chunk: resolved MarkupStream + remaining content
		expect(chunks).toEqual(["<div>before ", "<span>async content</span> after</div>"]);
	});

	test("renders nested async content", async () => {
		const innerStream = new MarkupStream("span", null, Promise.resolve(["inner async"]));
		const outerStream = new MarkupStream("div", null, ["start ", innerStream, " end"]);

		const chunks = await Array.fromAsync(renderStream(outerStream));
		// First chunk: everything up to the promise inside the span
		// Second chunk: resolved promise content + remaining
		expect(chunks).toEqual(["<div>start <span>", "inner async</span> end</div>"]);
	});

	test("handles multiple async items in sequence", async () => {
		const stream = new MarkupStream(null, null, [
			"a",
			Promise.resolve("b"),
			"c",
			Promise.resolve("d"),
			"e",
		]);

		const result = await render(stream);
		expect(result).toBe("abcde");
	});
});

describe("concurrent promise resolution", () => {
	test("renders promises in correct order when second resolves first", async () => {
		const cp1 = asyncGate();
		const cp2 = asyncGate();

		const order: string[] = [];

		const promise1 = (async () => {
			await cp1.block();
			order.push("first");
			return "first";
		})();

		const promise2 = (async () => {
			await cp2.block();
			order.push("second");
			return "second";
		})();

		const stream = new MarkupStream("div", null, [
			"start ",
			promise1,
			" middle ",
			promise2,
			" end",
		]);

		// Start collection in background
		const chunksPromise = (async () => {
			const chunks: string[] = [];
			for await (const chunk of renderStream(stream)) {
				chunks.push(chunk);
			}
			return chunks;
		})();

		await cp1.hasBlocked();
		await cp2.hasBlocked();

		// Release second first to test out-of-order resolution
		await cp2.releaseAndWaitTick();
		await cp1.releaseAndWaitTick();

		// Get the final result
		const chunks = await chunksPromise;

		expect(order).toEqual(["second", "first"]);
		expect(chunks.join("")).toBe("<div>start first middle second end</div>");
	});

	test("handles nested streams with out-of-order resolution", async () => {
		const cpInner = asyncGate();
		const cpOuter = asyncGate();

		const innerPromise = (async () => {
			await cpInner.block();
			return "inner content";
		})();

		const outerPromise = (async () => {
			await cpOuter.block();
			return new MarkupStream("span", { class: "nested" }, [innerPromise]);
		})();

		const stream = new MarkupStream("div", null, ["before ", outerPromise, " after"]);

		// Start collection in background
		const chunksPromise = (async () => {
			const chunks: string[] = [];
			for await (const chunk of renderStream(stream)) {
				chunks.push(chunk);
			}
			return chunks;
		})();

		await cpInner.hasBlocked();
		await cpOuter.hasBlocked();

		// Resolve inner first (but it's inside outer which isn't resolved yet)
		await cpInner.releaseAndWaitTick();

		// Now resolve outer
		await cpOuter.releaseAndWaitTick();

		// Get the final result
		const chunks = await chunksPromise;
		expect(chunks.join("")).toBe(
			'<div>before <span class="nested">inner content</span> after</div>',
		);
	});
});

describe("edge cases", () => {
	test("handles deeply nested structures", async () => {
		const deep = new MarkupStream("i", null, ["deep"]);
		const nested = new MarkupStream("b", null, [deep]);
		const stream = new MarkupStream("div", null, [
			"start ",
			new MarkupStream("span", null, [nested]),
			" end",
		]);

		expect(await render(stream)).toBe("<div>start <span><b><i>deep</i></b></span> end</div>");
	});

	test("handles empty arrays", async () => {
		const stream = new MarkupStream("div", null, [[]]);
		expect(await render(stream)).toBe("<div></div>");
	});

	test("handles promise resolving to null", async () => {
		const stream = new MarkupStream("div", null, ["before ", Promise.resolve(null), " after"]);

		const result = await render(stream);
		expect(result).toBe("<div>before  after</div>");
	});

	test("handles promise resolving to array with mixed content", async () => {
		const stream = new MarkupStream("div", null, [
			Promise.resolve(["text", 42, null, new MarkupStream("span", null, ["nested"])] as JSXNode[]),
		]);

		const result = await render(stream);
		expect(result).toBe("<div>text42<span>nested</span></div>");
	});

	test("handles falsy number 0", async () => {
		const stream = new MarkupStream(null, null, [0, " items"]);
		expect(await render(stream)).toBe("0 items");
	});

	test("handles empty string", async () => {
		const stream = new MarkupStream(null, null, ["", "text", ""]);
		expect(await render(stream)).toBe("text");
	});
});

describe("HTML mode (default)", () => {
	test("renders empty tags without closing tag", async () => {
		const br = new MarkupStream("br", null, []);
		expect(await render(br)).toBe("<br>");

		const input = new MarkupStream("input", { type: "text" }, []);
		expect(await render(input)).toBe('<input type="text">');

		const img = new MarkupStream("img", { src: "test.jpg" }, []);
		expect(await render(img)).toBe('<img src="test.jpg">');
	});

	test("renders boolean attributes correctly", async () => {
		const input = new MarkupStream(
			"input",
			{
				type: "checkbox",
				checked: true,
				disabled: false,
				readonly: true,
			},
			[],
		);
		expect(await render(input)).toBe('<input type="checkbox" checked readonly>');
	});

	test("renders non-boolean attributes with boolean values as strings", async () => {
		const div = new MarkupStream(
			"div",
			{
				id: false,
				"data-active": true,
				"aria-hidden": false,
			},
			[],
		);
		expect(await render(div)).toBe('<div id="false" data-active="true" aria-hidden="false"></div>');
	});

	test("renders empty elements with immediate closing", async () => {
		const div = new MarkupStream("div", null, []);
		expect(await render(div)).toBe("<div></div>");

		const span = new MarkupStream("span", { id: "test" }, []);
		expect(await render(span)).toBe('<span id="test"></span>');
	});
});

describe("function content", () => {
	test("renders function returning string", async () => {
		const stream = new MarkupStream("div", null, ["before ", () => "function result", " after"]);
		expect(await render(stream)).toBe("<div>before function result after</div>");
	});

	test("renders function returning MarkupStream", async () => {
		const stream = new MarkupStream("div", null, [
			"text ",
			() => new MarkupStream("span", { id: "lazy" }, ["lazy content"]),
		]);
		expect(await render(stream)).toBe('<div>text <span id="lazy">lazy content</span></div>');
	});

	test("renders function returning array", async () => {
		const stream = new MarkupStream("div", null, [() => ["a", "b", "c"]]);
		expect(await render(stream)).toBe("<div>abc</div>");
	});

	test("renders function returning null/undefined/boolean", async () => {
		const stream = new MarkupStream("div", null, [
			"start",
			() => null,
			() => undefined,
			() => true,
			() => false,
			"end",
		]);
		expect(await render(stream)).toBe("<div>startend</div>");
	});

	test("renders nested functions", async () => {
		const stream = new MarkupStream("div", null, [() => () => () => "deeply nested"]);
		expect(await render(stream)).toBe("<div>deeply nested</div>");
	});

	test("renders function returning promise", async () => {
		const stream = new MarkupStream("div", null, [
			"before ",
			() => Promise.resolve("async from function"),
			" after",
		]);
		const result = await render(stream);
		expect(result).toBe("<div>before async from function after</div>");
	});

	test("handles complex edge case: function → promise → function → content", async () => {
		const complexContent = () => Promise.resolve(() => "final content");

		const stream = new MarkupStream("div", null, ["before ", complexContent, " after"]);

		const result = await render(stream);
		expect(result).toBe("<div>before final content after</div>");
	});

	test("handles even more complex: function → promise → function → promise → function", async () => {
		const veryComplex = () => Promise.resolve(() => Promise.resolve(() => "very final"));

		const stream = new MarkupStream("div", null, ["start ", veryComplex, " end"]);

		const result = await render(stream);
		expect(result).toBe("<div>start very final end</div>");
	});

	test("functions are called lazily during rendering", async () => {
		let callCount = 0;
		const trackingFunction = () => {
			callCount++;
			return `called ${callCount} time(s)`;
		};

		const stream = new MarkupStream("div", null, [trackingFunction]);

		// Function shouldn't be called yet
		expect(callCount).toBe(0);

		// Now render, which should call the function
		const result = await render(stream);
		expect(callCount).toBe(1);
		expect(result).toBe("<div>called 1 time(s)</div>");
	});

	test("multiple functions in sequence", async () => {
		let counter = 0;
		const makeFunction = () => () => `${++counter}`;

		const stream = new MarkupStream("div", null, [
			makeFunction(),
			"-",
			makeFunction(),
			"-",
			makeFunction(),
		]);

		expect(await render(stream)).toBe("<div>1-2-3</div>");
	});

	test("content function is called twice when stream is rendered twice", async () => {
		let callCount = 0;
		const trackingFunction = () => {
			callCount++;
			return `called ${callCount} time(s)`;
		};

		const stream = new MarkupStream("div", null, [trackingFunction]);

		// Function shouldn't be called yet
		expect(callCount).toBe(0);

		const result1 = await render(stream);
		expect(callCount).toBe(1);
		expect(result1).toBe("<div>called 1 time(s)</div>");

		const result2 = await render(stream);
		expect(callCount).toBe(2);
		expect(result2).toBe("<div>called 2 time(s)</div>");
	});
});

describe("context handling", () => {
	test("context propagates to children", async () => {
		const testKey = createKey<string>({ displayName: "test" });
		const stream = new MarkupStream("div", null, [
			(ctx) => {
				ctx.set(testKey, "parent");
				return new MarkupStream("span", null, [(ctx) => ctx.get(testKey) || "not found"]);
			},
		]);
		expect(await render(stream)).toBe("<div><span>parent</span></div>");
	});

	test("context changes don't affect siblings", async () => {
		const testKey = createKey<string>({ displayName: "test" });
		const stream = new MarkupStream("div", null, [
			(ctx) => {
				ctx.set(testKey, "first");
				return "first";
			},
			(ctx) => ctx.get(testKey) || "empty", // Should be "empty"
		]);
		expect(await render(stream)).toBe("<div>firstempty</div>");
	});

	test("nested context overrides", async () => {
		const testKey = createKey<string>({ displayName: "test" });
		const stream = new MarkupStream("div", null, [
			(ctx) => {
				ctx.set(testKey, "parent");
				const afterSet = ctx.get(testKey); // Should be "parent"
				return [
					(ctx) => {
						const parentValue = ctx.get(testKey);
						ctx.set(testKey, "child");
						// Check that parent value is still accessible in same function after child set
						const stillParent = ctx.get(testKey); // Should be "child" now
						return [
							`parent:${parentValue}`,
							"-",
							`afterChildSet:${stillParent}`,
							"-",
							(ctx) => `child:${ctx.get(testKey)}`,
						];
					},
					"-",
					`afterSetInParent:${afterSet}`,
				];
			},
		]);
		expect(await render(stream)).toBe(
			"<div>parent:parent-afterChildSet:child-child:child-afterSetInParent:parent</div>",
		);
	});

	test("context propagates through arrays", async () => {
		const testKey = createKey<number>({ displayName: "count" });
		const stream = new MarkupStream("div", null, [
			(ctx) => {
				ctx.set(testKey, 1);
				return [
					"first:",
					(ctx) => String(ctx.get(testKey)),
					["-second:", (ctx) => String(ctx.get(testKey))],
				];
			},
		]);
		expect(await render(stream)).toBe("<div>first:1-second:1</div>");
	});

	test("context propagates through nested MarkupStreams", async () => {
		const testKey = createKey<string>({ displayName: "theme" });
		const stream = new MarkupStream("div", null, [
			(ctx) => {
				ctx.set(testKey, "dark");
				return new MarkupStream("section", null, [
					new MarkupStream("p", null, [(ctx) => `Theme: ${ctx.get(testKey)}`]),
				]);
			},
		]);
		expect(await render(stream)).toBe("<div><section><p>Theme: dark</p></section></div>");
	});

	test("context propagates through async functions", async () => {
		const testKey = createKey<string>({ displayName: "async" });
		const stream = new MarkupStream("div", null, [
			(ctx) => {
				ctx.set(testKey, "async-value");
				return Promise.resolve((ctx) => ctx.get(testKey) || "not found");
			},
		]);
		const result = await render(stream);
		expect(result).toBe("<div>async-value</div>");
	});

	test("complex: function → promise → function → content", async () => {
		const testKey = createKey<string>({ displayName: "complex" });
		const complexContent = (ctx: Context) => {
			ctx.set(testKey, "level1");
			return Promise.resolve((ctx: Context) => {
				const val = ctx.get(testKey);
				return `final:${val}`;
			});
		};

		const stream = new MarkupStream("div", null, ["before ", complexContent, " after"]);

		const result = await render(stream);
		expect(result).toBe("<div>before final:level1 after</div>");
	});

	test("even more complex: function → promise → function → promise → function", async () => {
		const testKey = createKey<string>({ displayName: "chain" });
		const veryComplex = (ctx: Context) => {
			ctx.set(testKey, "level1");
			return Promise.resolve((ctx: Context) => {
				const val1 = ctx.get(testKey);
				ctx.set(testKey, "level2");
				return Promise.resolve((ctx: Context) => `${val1}-${ctx.get(testKey)}`);
			});
		};

		const stream = new MarkupStream("div", null, ["start ", veryComplex, " end"]);

		const result = await render(stream);
		expect(result).toBe("<div>start level1-level2 end</div>");
	});

	test("context isolation between parallel siblings", async () => {
		const key1 = createKey<string>({ displayName: "key1" });
		const key2 = createKey<string>({ displayName: "key2" });

		const stream = new MarkupStream("div", null, [
			(ctx) => {
				ctx.set(key1, "a");
				return [
					(ctx) => {
						ctx.set(key2, "b");
						return `1:${ctx.get(key1)}-${ctx.get(key2)}`;
					},
					(ctx) => `2:${ctx.get(key1) || "null"}-${ctx.get(key2) || "null"}`,
				];
			},
			(ctx) => `3:${ctx.get(key1) || "null"}-${ctx.get(key2) || "null"}`,
		]);

		expect(await render(stream)).toBe("<div>1:a-b2:a-null3:null-null</div>");
	});

	test("multiple functions with shared context propagation", async () => {
		const counterKey = createKey<number>({ displayName: "counter" });

		const makeIncrement = () => (ctx: Context) => {
			const current = ctx.get(counterKey) || 0;
			ctx.set(counterKey, current + 1);
			return String(current + 1);
		};

		const makeRead = () => (ctx: Context) => String(ctx.get(counterKey) || 0);

		const stream = new MarkupStream("div", null, [
			makeIncrement(),
			"-",
			makeRead(), // Should be 0 (sibling doesn't see the change)
			[
				(ctx) => {
					ctx.set(counterKey, 10);
					return [makeIncrement(), "-", makeRead()]; // incrementer sets to 11, but reader is a sibling so sees 10
				},
			],
		]);

		expect(await render(stream)).toBe("<div>1-011-10</div>");
	});

	test("async siblings have isolated contexts", async () => {
		const gate1 = asyncGate();
		const gate2 = asyncGate();
		const token = createKey<string>();

		const stream = new MarkupStream(null, null, [
			[
				async (ctx) => {
					ctx.set(token, "value1");
					await gate1.block();
					return `s1=${ctx.get(token)};`;
				},
				async (ctx) => {
					await gate2.block();
					ctx.set(token, "value2"); // would pollute sibling1 if contexts were shared
					return `s2=${ctx.get(token)};`;
				},
			],
		]);
		const renderPromise = render(stream);

		await gate1.hasBlocked(); // sibling1 has set value1 and is waiting
		await gate2.releaseAndWaitTick(); // let sibling2 set value2
		await gate1.releaseAndWaitTick(); // let sibling1 read - should still see value1

		const result = await renderPromise;

		expect(result).toBe("s1=value1;s2=value2;");
	});
});

describe("XML mode", () => {
	test("renders empty elements with self-closing tags", async () => {
		const br = new MarkupStream("br", null, []);
		expect(await render(br, { mode: "xml" })).toBe("<br />");

		const div = new MarkupStream("div", null, []);
		expect(await render(div, { mode: "xml" })).toBe("<div />");

		const input = new MarkupStream("input", { type: "text" }, []);
		expect(await render(input, { mode: "xml" })).toBe('<input type="text" />');
	});

	test("renders all attributes with values", async () => {
		const input = new MarkupStream(
			"input",
			{
				type: "checkbox",
				checked: true,
				disabled: false,
				readonly: true,
			},
			[],
		);
		expect(await render(input, { mode: "xml" })).toBe(
			'<input type="checkbox" checked="true" disabled="false" readonly="true" />',
		);
	});

	test("renders elements with content normally", async () => {
		const div = new MarkupStream("div", null, ["content"]);
		expect(await render(div, { mode: "xml" })).toBe("<div>content</div>");

		const span = new MarkupStream("span", { id: "test" }, ["text"]);
		expect(await render(span, { mode: "xml" })).toBe('<span id="test">text</span>');
	});

	test("handles nested empty elements", async () => {
		const outer = new MarkupStream("outer", null, [
			new MarkupStream("inner", null, []),
			new MarkupStream("br", null, []),
		]);
		expect(await render(outer, { mode: "xml" })).toBe("<outer><inner /><br /></outer>");
	});
});

describe("error handling", () => {
	test("content-function-error: handles synchronous error in content function", async () => {
		const errorMessage = "Synchronous error in content function";
		const stream = new MarkupStream("div", null, [
			"before ",
			() => {
				throw new Error(errorMessage);
			},
			" after",
		]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain(errorMessage);
			expect(err.cause).toBeInstanceOf(Error);
			expect((err.cause as Error).message).toBe(errorMessage);
			expect(err.errorKind).toBe("content-function-error");
		}
	});

	test("content-function-promise-rejection: handles promise rejection from content function", async () => {
		const errorMessage = "Promise rejected in content function";
		const stream = new MarkupStream("section", null, [
			"start ",
			() => Promise.reject(new Error(errorMessage)),
			" end",
		]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain(errorMessage);
			expect(err.cause).toBeInstanceOf(Error);
			expect((err.cause as Error).message).toBe(errorMessage);
			expect(err.errorKind).toBe("content-function-promise-rejection");
		}
	});

	test("content-promise-error: handles standalone promise rejection", async () => {
		const errorMessage = "Standalone promise rejection";
		const stream = new MarkupStream("article", null, [
			"before ",
			Promise.reject(new Error(errorMessage)),
			" after",
		]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain(errorMessage);
			expect(err.cause).toBeInstanceOf(Error);
			expect((err.cause as Error).message).toBe(errorMessage);
			expect(err.errorKind).toBe("content-promise-error");
		}
	});

	test("shows nested component stack in error", async () => {
		const stream = new MarkupStream("outer", { id: "test" }, [
			new MarkupStream("middle", null, [
				new MarkupStream("inner", null, [
					() => {
						throw new Error("Deep error");
					},
				]),
			]),
		]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toMatchInlineSnapshot(
				`"Rendering error: Deep error; Component stack: <outer> -> <middle> -> <inner>"`,
			);
			expect(err.componentStack).toEqual(["outer", "middle", "inner"]);
		}
	});

	test("handles Error objects thrown from content functions", async () => {
		const stream = new MarkupStream("div", null, [
			() => {
				throw new Error("string error");
			},
		]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain("string error");
			expect(err.cause).toBeInstanceOf(Error);
			expect((err.cause as Error).message).toBe("string error");
			expect(err.errorKind).toBe("content-function-error");
		}
	});

	test("handles non-Error thrown values", async () => {
		const stream = new MarkupStream("div", null, [
			() => {
				throw "plain string error";
			},
		]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain("plain string error");
			expect(err.cause).toBe("plain string error");
			expect(err.errorKind).toBe("content-function-error");
		}
	});

	test("errors in nested arrays are caught", async () => {
		const stream = new MarkupStream("div", null, [
			"start",
			[
				"nested",
				[
					() => {
						throw new Error("Nested array error");
					},
				],
			],
			"end",
		]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain("Nested array error");
			expect(err.errorKind).toBe("content-function-error");
		}
	});

	test("invalid-content: detects React JSX elements", async () => {
		// Create a mock React element
		const reactElement = {
			$$typeof: Symbol.for("react.element"),
			type: "div",
			props: { children: "React content" },
			key: null,
			ref: null,
		};

		const stream = new MarkupStream("div", null, ["before ", reactElement, " after"]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain("Encountered a React JSX element");
			expect(err.message).toContain("@jsxImportSource beynac/view");
			expect(err.errorKind).toBe("invalid-content");
			expect(err.componentStack).toEqual(["div"]);
		}
	});

	test("invalid-content: detects React JSX in nested components", async () => {
		const reactElement = {
			$$typeof: Symbol.for("react.element"),
			type: "span",
			props: {},
			key: null,
			ref: null,
		};

		const stream = new MarkupStream("outer", null, [
			new MarkupStream("middle", null, [new MarkupStream("inner", null, [reactElement])]),
		]);

		try {
			await render(stream);
			throw new Error("Expected render(stream) to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(RenderingError);
			const err = error as RenderingError;
			expect(err.message).toContain("Encountered a React JSX element");
			expect(err.errorKind).toBe("invalid-content");
			expect(err.componentStack).toEqual(["outer", "middle", "inner"]);
		}
	});
});

describe("renderResponse", () => {
	test("renders content to Response object with default headers", async () => {
		const stream = new MarkupStream("div", { id: "test" }, ["Hello World"]);
		const response = await renderResponse(stream);

		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(await response.text()).toBe('<div id="test">Hello World</div>');
	});

	test("accepts custom status code", async () => {
		const stream = new MarkupStream("div", null, ["Created"]);
		const response = await renderResponse(stream, { status: 201 });

		expect(response.status).toBe(201);
		expect(await response.text()).toBe("<div>Created</div>");
	});

	test("accepts custom headers while preserving Content-Type", async () => {
		const stream = new MarkupStream("p", null, ["Test"]);
		const response = await renderResponse(stream, {
			headers: {
				"X-Custom-Header": "custom-value",
			},
		});

		expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
		expect(await response.text()).toBe("<p>Test</p>");
	});

	test("accepts custom Headers object while preserving Content-Type", async () => {
		const stream = new MarkupStream("p", null, ["Test"]);
		const response = await renderResponse(stream, {
			headers: new Headers({
				"x-custom-header": "custom-value",
			}),
		});

		expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
		expect(await response.text()).toBe("<p>Test</p>");
	});

	test("allows overriding Content-Type header", async () => {
		const stream = new MarkupStream("svg", { xmlns: "http://www.w3.org/2000/svg" }, []);
		const response = await renderResponse(stream, {
			headers: {
				"Content-Type": "image/svg+xml",
			},
		});

		expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
		expect(await response.text()).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
	});

	test("allows overriding Content-Type header with Headers object", async () => {
		const stream = new MarkupStream("svg", { xmlns: "http://www.w3.org/2000/svg" }, []);
		const response = await renderResponse(stream, {
			headers: {
				"CONTENT-TYPE": "image/svg+xml",
			},
		});

		expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
		expect(await response.text()).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
	});

	test("uses xml mode for Content-Type", async () => {
		const stream = new MarkupStream("root", null, [new MarkupStream("child", null, [])]);
		const response = await renderResponse(stream, { mode: "xml" });

		expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
		expect(await response.text()).toBe("<root><child /></root>");
	});

	test("passes mode to render for xml self-closing tags", async () => {
		const stream = new MarkupStream("root", null, []);
		const response = await renderResponse(stream, { mode: "xml" });

		expect(await response.text()).toBe("<root />");
	});

	test("works with async content", async () => {
		const stream = new MarkupStream("div", null, [
			"before ",
			Promise.resolve("async content"),
			" after",
		]);
		const response = await renderResponse(stream);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<div>before async content after</div>");
	});

	test("streams content with delayed async rendering", async () => {
		const checkpoint = asyncGate();

		const stream = new MarkupStream("div", null, [
			"before ",
			(async () => {
				await checkpoint.block();
				return "delayed";
			})(),
			" after",
		]);

		const response = await renderResponse(stream, { streaming: true });

		// Start reading response body asynchronously
		const reader = response.body?.getReader();
		expect(reader).toBeDefined();
		if (!reader) throw new Error("No reader");

		const decoder = new TextDecoder();
		const chunks: string[] = [];

		// Read first chunk (should be available before checkpoint release)
		const firstChunk = await reader.read();
		expect(firstChunk.done).toBe(false);
		if (firstChunk.value) {
			chunks.push(decoder.decode(firstChunk.value as Uint8Array, { stream: true }));
		}

		// Verify we got the content before the promise
		expect(chunks[0]).toBe("<div>before ");

		// Now release the checkpoint
		await checkpoint.hasBlocked();
		checkpoint.release();

		// Read remaining chunks
		let result = await reader.read();
		while (!result.done) {
			if (result.value) {
				chunks.push(decoder.decode(result.value as Uint8Array, { stream: true }));
			}
			result = await reader.read();
		}

		// Verify complete output
		expect(chunks.join("")).toBe("<div>before delayed after</div>");
	});

	test("buffers content when streaming is false", async () => {
		const stream = new MarkupStream("div", null, ["before ", Promise.resolve("async"), " after"]);

		const response = await renderResponse(stream, { streaming: false });
		expect(await response.text()).toBe("<div>before async after</div>");
	});

	test("can be used as controller return value", async () => {
		const content = new MarkupStream("html", null, [
			new MarkupStream("body", null, [new MarkupStream("h1", null, ["Welcome"])]),
		]);

		const response = await renderResponse(content, { status: 200 });

		expect(response).toBeInstanceOf(Response);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(await response.text()).toBe("<html><body><h1>Welcome</h1></body></html>");
	});
});
