/** @jsxImportSource . */
import { expect, test } from "bun:test";
import { render } from "../test-utils/view-test-utils.bun.ts";
import { Once } from "./once.ts";

test("Once renders content the first time a key is encountered", async () => {
	const result = await render(
		<div>
			<Once key="test1">First</Once>
			<Once key="test2">Second</Once>
		</div>,
	);
	expect(result).toBe("<div>FirstSecond</div>");
});

test("Once renders nothing when the same key is encountered again", async () => {
	const result = await render(
		<div>
			<Once key="same">First appearance</Once>
			<Once key="same">Second appearance</Once>
			<Once key="same">Third appearance</Once>
		</div>,
	);
	expect(result).toBe("<div>First appearance</div>");
});

test("Once works with different keys", async () => {
	const result = await render(
		<div>
			<Once key="a">A</Once>
			<Once key="b">B</Once>
			<Once key="a">A again</Once>
			<Once key="c">C</Once>
			<Once key="b">B again</Once>
		</div>,
	);
	expect(result).toBe("<div>ABC</div>");
});

test("Once works with complex children", async () => {
	const Component = async () => <i>Italic</i>;
	const result = await render(
		<div>
			<Once key="complex">
				<strong>Bold</strong>
				<Component />
			</Once>
			<Once key="complex">
				<span>This should not appear</span>
			</Once>
		</div>,
	);
	expect(result).toBe("<div><strong>Bold</strong><i>Italic</i></div>");
});

test("Once works within components", async () => {
	const Header = () => (
		<Once key="header">
			<style>{`h1 { color: blue; }`}</style>
		</Once>
	);

	const Page = () => (
		<div>
			<Header />
			<h1>Page 1</h1>
			<Header />
			<h1>Page 2</h1>
		</div>
	);

	const result = await render(<Page />);
	expect(result).toBe(
		"<div><style>h1 { color: blue; }</style><h1>Page 1</h1><h1>Page 2</h1></div>",
	);
});

test("Once with null or undefined children", async () => {
	const result = await render(
		<div>
			<Once key="1">{null}</Once>
			<Once key="2">{undefined}</Once>
			<Once key="3">{false}</Once>
			Text after
		</div>,
	);
	expect(result).toBe("<div>Text after</div>");
});

test("Once persists state across nested components", async () => {
	const ChildA = () => (
		<>
			<Once key="shared">From A</Once>
			<span>A</span>
		</>
	);

	const ChildB = () => (
		<>
			<Once key="shared">From B</Once>
			<span>B</span>
		</>
	);

	const Parent = () => (
		<div>
			<ChildA />
			<ChildB />
		</div>
	);

	const result = await render(<Parent />);
	expect(result).toBe("<div>From A<span>A</span><span>B</span></div>");
});

test("Once works across multiple renders", async () => {
	const Component1 = () => (
		<div>
			<Once key="style">
				<style>{`body { margin: 0; }`}</style>
			</Once>
			<h1>Page 1</h1>
		</div>
	);

	const jsx = <Component1 />;

	expect(await render(jsx)).toBe("<div><style>body { margin: 0; }</style><h1>Page 1</h1></div>");

	expect(await render(jsx)).toBe("<div><style>body { margin: 0; }</style><h1>Page 1</h1></div>");
});

test("Once.createComponent() creates a component with no key prop", async () => {
	const MyOnce = Once.createComponent("my-unique-key");

	// @ts-expect-error key prop is not allowed
	void (<MyOnce key={"ignored-key"} />);

	const result = await render(
		<div>
			<MyOnce>First</MyOnce>
			<MyOnce>Second</MyOnce>
		</div>,
	);
	expect(result).toBe("<div>First</div>");
});

test("Once.createComponent() with no argument generates unique symbol", async () => {
	const OnceA = Once.createComponent();
	const OnceB = Once.createComponent();

	const result = await render(
		<div>
			<OnceA>From A</OnceA>
			<OnceB>From B</OnceB>
			<OnceA>From A again</OnceA>
			<OnceB>From B again</OnceB>
		</div>,
	);
	expect(result).toBe("<div>From AFrom B</div>");
});

test("Once.createComponent() sets displayName", async () => {
	const OnceWithKey = Once.createComponent("test-key");
	expect(OnceWithKey.displayName).toBe("Once(test-key)");

	const OnceWithSymbol = Once.createComponent();
	expect(OnceWithSymbol.displayName).toMatch(/^Once\(once-\d+\)$/);
});

test("Once accepts number and symbol keys", async () => {
	const symbolKey = Symbol("test");
	const result = await render(
		<div>
			<Once key={1}>Number key</Once>
			<Once key={symbolKey}>Symbol key</Once>
			<Once key={1}>Duplicate number</Once>
			<Once key={symbolKey}>Duplicate symbol</Once>
		</div>,
	);
	expect(result).toBe("<div>Number keySymbol key</div>");
});

test("Once respects document order with async content", async () => {
	let fastSecondHasRun = false;

	const SlowFirst = async () => {
		await Promise.resolve();
		await Promise.resolve();
		if (!fastSecondHasRun) {
			throw new Error("SlowFirst isn't as slow as expected!");
		}
		return <Once key="async">Slow but first</Once>;
	};

	const FastSecond = async () => {
		await Promise.resolve();
		fastSecondHasRun = true;
		return <Once key="async">Fast but second</Once>;
	};

	const result = await render(
		<div>
			<SlowFirst />
			<FastSecond />
		</div>,
	);

	expect(result).toBe("<div>Slow but first</div>");
});

test("Once respects document order with mixed sync and async content", async () => {
	const AsyncComponent = async () => {
		await Promise.resolve();
		return <Once key="mixed">From async</Once>;
	};

	const result = await render(
		<div>
			<AsyncComponent />
			<Once key="mixed">From sync</Once>
		</div>,
	);

	expect(result).toBe("<div>From async</div>");
});
