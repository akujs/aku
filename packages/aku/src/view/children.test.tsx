/** @jsxImportSource . */
import { expect, test } from "bun:test";
import { render } from "../test-utils/view.test-utils.ts";
import { childrenToArray } from "./children.ts";
import type { JSX, JSXNode } from "./view-types.ts";

test("childrenToArray filters out null, undefined, and boolean values", () => {
	const children = ["hello", null, 42, undefined, true, false, <span>world</span>, 0, ""];
	const result = childrenToArray(children);
	expect(result).toEqual(["hello", 42, <span>world</span>, 0, ""]);
});

test("childrenToArray wraps single non-array child", () => {
	const result = childrenToArray("hello");
	expect(result).toEqual(["hello"]);
});

test("childrenToArray returns empty array for null/undefined/boolean", () => {
	expect(childrenToArray(null)).toEqual([]);
	expect(childrenToArray(undefined)).toEqual([]);
	expect(childrenToArray(true)).toEqual([]);
	expect(childrenToArray(false)).toEqual([]);
});

test("component can use childrenToArray to wrap each child", async () => {
	function Wrapper(props: { children: JSXNode }) {
		const childArray = childrenToArray(props.children);
		return (
			<>
				{childArray.map((child) => (
					<div>{child}</div>
				))}
			</>
		);
	}

	const template = (
		<Wrapper>
			<span>1</span>
			{null}
			hello
			{4}
			{false}
			{undefined}
			{true}
		</Wrapper>
	);

	const result = await render(template);
	expect(result).toBe("<div><span>1</span></div><div>hello</div><div>4</div>");
});

test("component wrapping children with nested arrays", async () => {
	function Wrapper(props: { children: JSX.Children }) {
		const childArray = childrenToArray(props.children);
		return (
			<>
				{childArray.map((child, index) => (
					<div key={index}>{child}</div>
				))}
			</>
		);
	}

	const items = [<i>a</i>, <i>b</i>, null, <i>c</i>];
	const template = (
		<Wrapper>
			<span>first</span>
			{items}
			last
		</Wrapper>
	);

	const result = await render(template);
	expect(result).toBe(
		'<div key="0"><span>first</span></div><div key="1"><i>a</i><i>b</i><i>c</i></div><div key="2">last</div>',
	);
});
