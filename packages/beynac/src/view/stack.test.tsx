/** @jsxImportSource beynac/view */
import { expect, test } from "bun:test";
import { createKey } from "../core/Key.ts";
import { asyncGate } from "../test-utils/async-gate.ts";
import { render, renderStream } from "../test-utils/view-test-utils.ts";
import type { Component } from "./Component.ts";
import { Once } from "./once.ts";
import { createStack } from "./stack.ts";
import type { Context } from "./view-types.ts";

test("basic Stack push and out functionality", async () => {
	const MyStack = createStack();

	const result = await render(
		<div>
			<MyStack.Push>First</MyStack.Push>
			<MyStack.Push>Second</MyStack.Push>
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div>FirstSecond</div>");
});

test("StackOut can appear before Stack pushes", async () => {
	const MyStack = createStack();

	const result = await render(
		<div>
			<MyStack.Out />
			<MyStack.Push>After</MyStack.Push>
		</div>,
	);

	expect(result).toBe("<div>After</div>");
});

test("Stack preserves document order with async components", async () => {
	const MyStack = createStack();

	let fastSecondHasRun = false;

	const SlowFirst = async () => {
		await Promise.resolve();
		await Promise.resolve();
		if (!fastSecondHasRun) {
			throw new Error("SlowFirst isn't as slow as expected!");
		}
		return <MyStack.Push>Slow but first</MyStack.Push>;
	};

	const FastSecond = async () => {
		await Promise.resolve();
		fastSecondHasRun = true;
		return <MyStack.Push>Fast but second</MyStack.Push>;
	};

	const result = await render(
		<div>
			<SlowFirst />
			<FastSecond />
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div>Slow but firstFast but second</div>");
});

test("Stack works with Once for deduplication", async () => {
	const MyStack = createStack();
	const StyleOnce = Once.createComponent("style");

	const result = await render(
		<div>
			<MyStack.Push>
				<StyleOnce>First style</StyleOnce>
			</MyStack.Push>
			<MyStack.Push>
				<StyleOnce>Second style</StyleOnce>
			</MyStack.Push>
			<MyStack.Push>Not deduped</MyStack.Push>
			<MyStack.Push>
				<StyleOnce>Third style</StyleOnce>
			</MyStack.Push>
			<MyStack.Push>Also not deduped</MyStack.Push>
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div>First styleNot dedupedAlso not deduped</div>");
});

test("StackOut throws when used twice", async () => {
	const MyStack = createStack();

	expect(
		render(
			<div>
				<MyStack.Out />
				<MyStack.Out />
			</div>,
		),
	).rejects.toThrow(/Stack.Out can only be used once per render/);
});

test("multiple independent stacks", async () => {
	const HeadStack = createStack();
	const FooterStack = createStack();

	const result = await render(
		<div>
			<HeadStack.Push>Head 1</HeadStack.Push>
			<FooterStack.Push>Footer 1</FooterStack.Push>
			<HeadStack.Push>Head 2</HeadStack.Push>
			<FooterStack.Push>Footer 2</FooterStack.Push>
			<div class="head">
				<HeadStack.Out />
			</div>
			<div class="footer">
				<FooterStack.Out />
			</div>
		</div>,
	);

	expect(result).toBe(
		'<div><div class="head">Head 1Head 2</div><div class="footer">Footer 1Footer 2</div></div>',
	);
});

test("Stack with complex nested content", async () => {
	const MyStack = createStack();

	const result = await render(
		<div>
			<MyStack.Push>
				<strong>Bold</strong>
				<em>Italic</em>
			</MyStack.Push>
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div><strong>Bold</strong><em>Italic</em></div>");
});

test("Stack with null and undefined content", async () => {
	const MyStack = createStack();

	const result = await render(
		<div>
			<MyStack.Push>{null}</MyStack.Push>
			<MyStack.Push>{undefined}</MyStack.Push>
			<MyStack.Push>{false}</MyStack.Push>
			<MyStack.Push>Visible</MyStack.Push>
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div>Visible</div>");
});

test("Stack preserves order across nested async components", async () => {
	const MyStack = createStack();

	const AsyncOuter = async () => {
		await Promise.resolve();
		return (
			<>
				<AsyncInner />
				<MyStack.Push>From outer</MyStack.Push>
			</>
		);
	};

	const AsyncInner = async () => {
		await Promise.resolve();
		await Promise.resolve();
		return <MyStack.Push>From inner</MyStack.Push>;
	};

	const result = await render(
		<div>
			<AsyncOuter />
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div>From innerFrom outer</div>");
});

test("Stack works with components that use Once inside", async () => {
	const MyStack = createStack();

	const AddStyle: Component<{ id: string }> = ({ id }) => {
		const StyleOnce = Once.createComponent(`style-${id}`);
		return (
			<MyStack.Push>
				<StyleOnce>
					<style>{`#${id} { color: blue; }`}</style>
				</StyleOnce>
			</MyStack.Push>
		);
	};

	const result = await render(
		<div>
			<AddStyle id="header" />
			<AddStyle id="footer" />
			<AddStyle id="header" />
			<MyStack.Out />
			<div id="header">Header</div>
			<div id="footer">Footer</div>
		</div>,
	);

	expect(result).toBe(
		'<div><style>#header { color: blue; }</style><style>#footer { color: blue; }</style><div id="header">Header</div><div id="footer">Footer</div></div>',
	);
});

test("Stack works with Once using number and symbol keys", async () => {
	const MyStack = createStack();
	const symbolKey = Symbol("test");
	const OnceOne = Once.createComponent(1);
	const OnceSymbol = Once.createComponent(symbolKey);
	const OnceTwo = Once.createComponent(2);

	const result = await render(
		<div>
			<MyStack.Push>
				<OnceOne>Number 1</OnceOne>
			</MyStack.Push>
			<MyStack.Push>
				<OnceSymbol>Symbol</OnceSymbol>
			</MyStack.Push>
			<MyStack.Push>
				<OnceOne>Number 1 again</OnceOne>
			</MyStack.Push>
			<MyStack.Push>
				<OnceSymbol>Symbol again</OnceSymbol>
			</MyStack.Push>
			<MyStack.Push>
				<OnceTwo>Number 2</OnceTwo>
			</MyStack.Push>
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div>Number 1SymbolNumber 2</div>");
});

test("Stack push works inside Once", async () => {
	const MyStack = createStack();

	const result = await render(
		<div>
			<Once key="once">
				<MyStack.Push>A</MyStack.Push>
			</Once>
			<Once key="once">
				<MyStack.Push>B</MyStack.Push>
			</Once>
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div>A</div>");
});

test("Once deduplication works across multiple stacks", async () => {
	const StackA = createStack();
	const StackB = createStack();

	const OnceX = Once.createComponent("x");
	const OnceY = Once.createComponent("y");

	const result = await render(
		<div>
			{/* Push X to StackA */}
			<StackA.Push>
				<OnceX>[X1]</OnceX>
			</StackA.Push>
			{/* Push X to StackB - won't render due to Once */}
			<StackB.Push>
				<OnceX>[X2]</OnceX>
			</StackB.Push>
			{/* Push Y to StackB */}
			<StackB.Push>
				<OnceY>[Y1]</OnceY>
			</StackB.Push>
			{/* Push Y to StackA */}
			<StackA.Push>
				<OnceY>[Y2]</OnceY>
			</StackA.Push>
			{/* Push Z to StackB (no Once) */}
			<StackB.Push>[Z]</StackB.Push>
			A:
			<StackA.Out />
			B:
			<StackB.Out />
		</div>,
	);

	// StackA renders: X1 (first OnceX encountered)
	// StackB renders: Y1 (first OnceY encountered), Z
	// X2 is skipped (OnceX already used), Y2 is skipped (OnceY already used)
	expect(result).toBe("<div>A:[X1]B:[Y1][Z]</div>");
});

test("StackOut can be pushed onto a stack", async () => {
	const A = createStack();
	const B = createStack();

	// B.Out is pushed to A, so B's content will appear where A.Out is
	const result = await render(
		<div>
			<A.Push>
				<b-out>
					<B.Out />
				</b-out>
			</A.Push>
			<B.Push>b-content</B.Push>
			<a-out>
				<A.Out />
			</a-out>
		</div>,
	);

	// B's content appears at A.Out location (wrapped in b-out marker)
	expect(result).toBe("<div><a-out><b-out>b-content</b-out></a-out></div>");
});

test("StackPush can be pushed onto a stack", async () => {
	const A = createStack();
	const B = createStack();

	// A.Push contains a function that returns B.Push
	// The B.Push content should appear at B.Out, not A.Out
	const result = await render(
		<div>
			<A.Push>
				{async () => {
					return <B.Push>b-content</B.Push>;
				}}
			</A.Push>
			<a-out>
				<A.Out />
			</a-out>
			<b-out>
				<B.Out />
			</b-out>
		</div>,
	);

	// B's content appears at B.Out, A is empty (contained only a function that pushed to B)
	expect(result).toBe("<div><a-out></a-out><b-out>b-content</b-out></div>");
});

test("Stack.Push preserves context from pre-execution", async () => {
	const MyStack = createStack();
	const TestKey = createKey<string>();

	const result = await render(
		<div>
			{(ctx: Context) => {
				// Outer function modifies context
				ctx.set(TestKey, "value-from-outer");

				// Return a Stack.Push containing another function
				return (
					<MyStack.Push>
						{(innerCtx) => {
							// Inner function should see the modified context
							const value = innerCtx.get(TestKey);
							return `[${value || "no-value"}]`;
						}}
					</MyStack.Push>
				);
			}}
			<MyStack.Out />
		</div>,
	);

	expect(result).toBe("<div>[value-from-outer]</div>");
});

test("Stacks maintain independent state and can render concurrently", async () => {
	const Stack = createStack();

	const DelayPush = async ({ delay }: { delay: number }) => {
		for (let i = 0; i < delay; i++) {
			await Promise.resolve();
		}
		return <Stack.Push>{delay}</Stack.Push>;
	};

	const Component = () => (
		<div>
			<Stack.Out />
			<DelayPush delay={1} />
			<DelayPush delay={2} />
			<DelayPush delay={3} />
			<DelayPush delay={4} />
			<DelayPush delay={5} />
		</div>
	);

	const [result1, result2] = await Promise.all([render(<Component />), render(<Component />)]);

	expect(result1).toBe("<div>12345</div>");
	expect(result2).toBe("<div>12345</div>");
});

test("deeply nested: Push contains Push contains Out", async () => {
	const A = createStack();
	const B = createStack();
	const C = createStack();

	const result = await render(
		<div>
			<A.Push>
				<B.Push>
					<c-out>
						<C.Out />
					</c-out>
				</B.Push>
			</A.Push>
			<C.Push>c-content</C.Push>
			<a-out>
				<A.Out />
			</a-out>
			<b-out>
				<B.Out />
			</b-out>
		</div>,
	);

	// C.Out is inside B.Push, which is inside A.Push
	// B.Push (containing C.Out) goes to A, but when A.Out renders,
	// it only contains the B.Push, not its content. B.Out shows C.Out with c-content
	expect(result).toBe("<div><a-out></a-out><b-out><c-out>c-content</c-out></b-out></div>");
});

test("mutual stack outputs: A pushes B.Out, B pushes A.Out", async () => {
	const A = createStack();
	const B = createStack();

	const result = await render(
		<div>
			<A.Push>
				a1-
				<b-out>
					<B.Out />
				</b-out>
			</A.Push>
			<B.Push>
				b1-
				<a-out>
					<A.Out />
				</a-out>
			</B.Push>
			<A.Push>-a2</A.Push>
			<B.Push>-b2</B.Push>
		</div>,
	);

	// This doesn't create a circular dependency because:
	// A.Push contains B.Out, B.Push contains A.Out
	// The Outs themselves aren't rendered yet, they're just pushed to stacks
	// Since neither A.Out nor B.Out appear at the root level, result is empty
	expect(result).toBe("<div></div>");
});

test("nested functions: Push with function returning Push with function", async () => {
	const A = createStack();
	const B = createStack();
	const C = createStack();

	const result = await render(
		<div>
			<A.Push>
				[a-start]
				{() => <B.Push>[b-start]{() => <C.Push>deeply-nested</C.Push>}[b-end]</B.Push>}
				[a-end]
			</A.Push>
			<a-out>
				<A.Out />
			</a-out>
			<b-out>
				<B.Out />
			</b-out>
			<c-out>
				<C.Out />
			</c-out>
		</div>,
	);

	// Function in A returns B.Push, function in B returns C.Push
	// Content should end up only in C
	expect(result).toBe(
		"<div><a-out>[a-start][a-end]</a-out><b-out>[b-start][b-end]</b-out><c-out>deeply-nested</c-out></div>",
	);
});

test("async function pushing to multiple stacks in sequence", async () => {
	const A = createStack();
	const B = createStack();
	const C = createStack();

	const result = await render(
		<div>
			<A.Push>
				{async () => {
					await Promise.resolve();
					return (
						<>
							<B.Push>to-b-from-a</B.Push>
							<C.Push>to-c-from-a</C.Push>
							direct-in-a
						</>
					);
				}}
			</A.Push>
			<a-out>
				<A.Out />
			</a-out>
			<b-out>
				<B.Out />
			</b-out>
			<c-out>
				<C.Out />
			</c-out>
		</div>,
	);

	// The async function's return value contains pushes to B and C
	// Only "direct-in-a" should appear in A
	expect(result).toBe(
		"<div><a-out>direct-in-a</a-out><b-out>to-b-from-a</b-out><c-out>to-c-from-a</c-out></div>",
	);
});

test("Push with Once containing another stack's Out", async () => {
	const A = createStack();
	const B = createStack();
	const OnceKey = Once.createComponent("key");

	const result = await render(
		<div>
			<A.Push>
				<OnceKey>
					once-[
					<b-out>
						<B.Out />
					</b-out>
					]
				</OnceKey>
			</A.Push>
			<A.Push>
				<OnceKey>
					ignored-[
					<b-out>
						<B.Out />
					</b-out>
					]
				</OnceKey>
			</A.Push>
			<B.Push>b-content</B.Push>
			<a-out>
				<A.Out />
			</a-out>
		</div>,
	);

	// First Once renders with B.Out, second is ignored
	// B's content appears nested inside A through the Once
	expect(result).toBe("<div><a-out>once-[<b-out>b-content</b-out>]</a-out></div>");
});

test("first Stack.Out streams immediately without buffering", async () => {
	const HeadStack = createStack();
	const FooterStack = createStack();

	// Create checkpoints to control when content is produced
	const cpHead1 = asyncGate();
	const cpHead2 = asyncGate();
	const cpFooter1 = asyncGate();
	const cpFooter2 = asyncGate();

	const AsyncHeadProducer = async () => {
		await cpHead1.block();
		return <HeadStack.Push>Head1</HeadStack.Push>;
	};

	const AsyncHeadProducer2 = async () => {
		await cpHead2.block();
		return <HeadStack.Push>Head2</HeadStack.Push>;
	};

	const AsyncFooterProducer = async () => {
		await cpFooter1.block();
		return <FooterStack.Push>Footer1</FooterStack.Push>;
	};

	const AsyncFooterProducer2 = async () => {
		await cpFooter2.block();
		return <FooterStack.Push>Footer2</FooterStack.Push>;
	};

	const document = (
		<html>
			<HeadStack.Push>PreHead</HeadStack.Push>
			<head>
				<HeadStack.Out />
			</head>
			<body>
				<AsyncHeadProducer />
				<AsyncHeadProducer2 />
				<div>Middle content</div>
				<AsyncFooterProducer />
				<AsyncFooterProducer2 />
				<footer>
					<FooterStack.Out />
				</footer>
			</body>
		</html>
	);

	// Collect chunks in parallel
	const chunks: string[] = [];
	const collectingPromise = (async () => {
		for await (const chunk of renderStream(document)) {
			chunks.push(chunk);
		}
	})();

	// Wait for all async producers to reach their checkpoints
	await cpHead1.hasBlocked();
	await cpHead2.hasBlocked();
	await cpFooter1.hasBlocked();
	await cpFooter2.hasBlocked();

	expect(chunks).toEqual([
		"<html>",
		"<head>",
		// When HeadStack.Out is encountered, PreHead content is immediately flushed
		"PreHead",
	]);

	// Release pushHead1 - Head1 should stream immediately (first Stack.Out optimization)
	await cpHead1.releaseAndWaitTick();
	expect(chunks.length).toBe(4);
	expect(chunks[3]).toBe("Head1");

	// Release pushHead2 - Head2 should also stream immediately
	await cpHead2.releaseAndWaitTick();
	expect(chunks.length).toBe(5);
	expect(chunks[4]).toBe("Head2");

	const chunksBeforeFooter = chunks.length;
	await cpFooter1.releaseAndWaitTick();
	// Because the footer stack is not the first stack, its chunks should not be
	// streamed. We are buffering them until the end of a document.
	expect(chunks.length).toBe(chunksBeforeFooter);
	await cpFooter2.releaseAndWaitTick();

	await collectingPromise;

	// Verify final output
	const fullOutput = chunks.join("");
	expect(fullOutput).toBe(
		"<html><head>PreHeadHead1Head2</head><body><div>Middle content</div><footer>Footer1Footer2</footer></body></html>",
	);
});
