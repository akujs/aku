/** @jsxImportSource beynac/view */
import { expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { createTypeToken } from "../container/container-key.ts";
import { createKey } from "../core/Key.ts";
import { render } from "../test-utils/view-test-utils.bun.ts";
import type { Component } from "./Component.ts";
import { BaseComponent } from "./Component.ts";
import { ViewRendererImpl } from "./ViewRendererImpl.ts";
import { type Context, isJsxElement, type JSX, type JSXNode, type Props } from "./view-types.ts";

test("renders single element with attributes and text child", async () => {
	expect(await render(<span id="foo">hello</span>)).toBe('<span id="foo">hello</span>');
});

test("renders childless non-empty elements", async () => {
	expect(await render(<span id="foo" />)).toBe('<span id="foo"></span>');
});

test("renders empty tags", async () => {
	expect(await render(<input />)).toBe("<input>");
	expect(await render(<input value="yo" />)).toBe('<input value="yo">');
});

test("supports null props", async () => {
	const template = <span data-hello={null}>Hello</span>;
	expect(await render(template)).toBe("<span>Hello</span>");
});

test("supports undefined props", async () => {
	const template = <span data-hello={undefined}>Hello</span>;
	expect(await render(template)).toBe("<span>Hello</span>");
});

test("throws error for void elements with children", async () => {
	expect(render(<link>content</link>)).rejects.toThrow(
		"<link> is a void element and must not have children",
	);

	expect(render(<input>text</input>)).rejects.toThrow(
		"<input> is a void element and must not have children",
	);
});

test("escapes attribute values", async () => {
	expect(await render(<input value={`I'm a "little" <teapot> short & stout`} />)).toBe(
		`<input value="I'm a &quot;little&quot; &lt;teapot&gt; short &amp; stout">`,
	);
});

test("shortens boolean attributes", async () => {
	expect(await render(<input type="checkbox" checked />)).toBe(`<input type="checkbox" checked>`);
});

test("omits boolean attributes with false value", async () => {
	expect(await render(<input type="checkbox" checked={false} />)).toBe(`<input type="checkbox">`);
});

test("renders bigints", async () => {
	const template = <span hello={42n}>{511n}</span>;
	expect(await render(template)).toBe('<span hello="42">511</span>');
});

test("default prop value for multiple select", async () => {
	const template = (
		<select multiple>
			<option>test</option>
		</select>
	);
	expect(await render(template)).toBe("<select multiple><option>test</option></select>");
});

test("does not shorten arbitrary boolean attributes", async () => {
	expect(await render(<input data-foo />)).toBe(`<input data-foo="true">`);
});

test("renders children", async () => {
	expect(
		await render(
			<div>
				<input type="checkbox" checked />
			</div>,
		),
	).toBe(`<div><input type="checkbox" checked></div>`);
});

test("renders fragments", async () => {
	expect(
		await render(
			<>
				<div>hello</div>
			</>,
		),
	).toBe(`<div>hello</div>`);
});

test("renders components", async () => {
	const Component = (props: { value: number }) => <span the-value={props.value} />;
	expect(
		await render(
			<div>
				<Component value={42} />
			</div>,
		),
	).toBe(`<div><span the-value="42"></span></div>`);
});

test("gives type error when function component prop has incorrect value", async () => {
	const Component = (props: { value: number }) => <span the-value={props.value} />;
	void (<Component value={42} />);
	void (
		<Component
			// @ts-expect-error
			value="string"
		/>
	);
	void (
		<Component
			// @ts-expect-error
			value={undefined}
		/>
	);
	void (
		(
			// @ts-expect-error
			<Component />
		)
	);
});

test("gives type error when class component prop has incorrect value", async () => {
	class C extends BaseComponent<{ value: number }> {
		render() {
			return <span the-value={this.props.value} />;
		}
	}
	void (<BaseComponent value={42} />);
	void (
		<C
			// @ts-expect-error
			value="string"
		/>
	);
	void (
		<C
			// @ts-expect-error
			value={undefined}
		/>
	);
	void (
		(
			// @ts-expect-error
			<C />
		)
	);
});

test("passes context to components", async () => {
	const k = createKey<number>();
	const C: Component = (_, context) => <span>{context.get(k)}</span>;

	expect(
		await render((ctx: Context) => {
			ctx.set(k, 42);
			return <C />;
		}),
	).toBe(`<span>42</span>`);
});

test("renders async component", async () => {
	const Child = async () => {
		await Promise.resolve();
		return <span>child</span>;
	};

	const Parent = async () => {
		await Promise.resolve();
		return (
			<div>
				parent
				<Child />
			</div>
		);
	};

	const c = <Parent />;
	const rendered = await render(c);
	expect(rendered).toBe("<div>parent<span>child</span></div>");
});

test("provides correct stack when a component throws an error", async () => {
	class ClassComponent extends BaseComponent {
		render(): JSX.Element {
			throw new Error("Intentional error");
		}
	}
	const FunctionComponent = () => <ClassComponent />;
	expect(FunctionComponent.name).toBe("FunctionComponent");
	expect(ClassComponent.name).toBe("ClassComponent");
	expect(
		render(
			<div>
				<FunctionComponent />
			</div>,
		),
	).rejects.toThrowErrorMatchingInlineSnapshot(
		`"Rendering error: Intentional error; Component stack: <div> -> <FunctionComponent> -> <ClassComponent>"`,
	);
});

test("Respects displayName in component stacks", async () => {
	class ClassComponent extends BaseComponent {
		static displayName = "MyClassDisplayName";
		render(): JSX.Element {
			throw new Error("Intentional error");
		}
	}
	const FunctionComponent = () => <ClassComponent />;
	FunctionComponent.displayName = "MyFunctionDisplayName";
	expect(FunctionComponent.name).toBe("FunctionComponent");
	expect(ClassComponent.name).toBe("ClassComponent");
	expect(
		render(
			<div>
				<FunctionComponent />
			</div>,
		),
	).rejects.toThrowErrorMatchingInlineSnapshot(
		`"Rendering error: Intentional error; Component stack: <div> -> <MyFunctionDisplayName> -> <MyClassDisplayName>"`,
	);
});

test("renders class component", async () => {
	class TestComponent extends BaseComponent {
		render() {
			return <span>from class</span>;
		}
	}
	expect(await render(<TestComponent />)).toBe("<span>from class</span>");
});

test("class component receives props", async () => {
	class TestComponent extends BaseComponent<{ value: string }> {
		render() {
			return <span>{this.props.value}</span>;
		}
	}
	expect(await render(<TestComponent value="hello" />)).toBe("<span>hello</span>");
});

test("class component receives context", async () => {
	const key = createKey<string>({ displayName: "test-key" });
	class TestComponent extends BaseComponent {
		render(context: Context): JSX.Element {
			const value = context.get(key);
			return <span>{value}</span>;
		}
	}
	const SetKey = (_props: Props, ctx: Context) => {
		ctx.set(key, "from context");
		return <TestComponent />;
	};
	expect(await render(<SetKey />)).toBe("<span>from context</span>");
});

test("renders async class component", async () => {
	class AsyncComponent extends BaseComponent {
		async render() {
			await Promise.resolve();
			return <span>async result</span>;
		}
	}
	expect(await render(<AsyncComponent />)).toBe("<span>async result</span>");
});

test("class component with dependency injection", async () => {
	const messageKey = createTypeToken<string>();
	const container = new ContainerImpl();
	container.bind(messageKey, { instance: "injected value" });

	class DIComponent extends BaseComponent {
		constructor(
			props: Props,
			private message: string = container.get(messageKey),
		) {
			super(props);
		}

		render() {
			return <span>{this.message}</span>;
		}
	}

	const renderer = new ViewRendererImpl(container);
	const result = await renderer.render(<DIComponent />);
	expect(result).toBe("<span>injected value</span>");
});

test("does not evaluate components until rendered", async () => {
	let evaluated = false;
	const Component = () => {
		evaluated = true;
		return <result />;
	};
	const jsx = <Component />;
	expect(evaluated).toBeFalse();
	await render(jsx);
	expect(evaluated).toBeTrue();
});

test("renders style attribute from object", async () => {
	const result = await render(
		<div
			style={{
				color: "red",
				backgroundColor: "blue",
				height: undefined,
				fontSize: 14,
			}}
		/>,
	);
	expect(result).toBe('<div style="color:red;background-color:blue;font-size:14px"></div>');
});

test("passing an array or other invalid value to style causes type error", async () => {
	// @ts-expect-error testing invalid usage
	void (<div style={[]} />);
	// @ts-expect-error testing invalid usage
	void (<div style={4} />);
	// @ts-expect-error testing invalid usage
	void (<div style={Symbol()} />);
});

test("passing invalid style values in object causes type error", async () => {
	void (<div style={{ textAlign: "center" }} />);
	void (
		<div
			style={{
				// @ts-expect-error testing invalid usage
				textAlign: "invalid",
			}}
		/>
	);
	void (<div style={{ flex: 4 }} />);
	void (
		<div
			style={{
				// @ts-expect-error testing invalid usage
				color: 4,
			}}
		/>
	);
});

test("omits style attribute on no object styles", async () => {
	const result = await render(
		<div
			style={{
				height: undefined,
			}}
		/>,
	);
	expect(result).toBe("<div></div>");
});

test("does not omit empty string style attribute", async () => {
	const result = await render(<span style="" />);
	expect(result).toBe('<span style=""></span>');
});

test("should give type error on invalid attribute value for known attribute", async () => {
	// @ts-expect-error -- testing expected error
	void (<span id={Promise.resolve("hello")}></span>);
	// @ts-expect-error -- testing expected error
	void (<span id={Symbol()}></span>);
});

test("invalid attribute values throw during rendering", async () => {
	expect(
		render(
			<div>
				<span foo={Promise.resolve("hello")}></span>
			</div>,
		),
	).rejects.toThrowErrorMatchingInlineSnapshot(
		`"Rendering error: Attribute "foo" has an invalid value type: Promise; Component stack: <div> -> <span>"`,
	);

	expect(
		render(
			<div>
				<span bar={Symbol("test")}></span>
			</div>,
		),
	).rejects.toThrowErrorMatchingInlineSnapshot(
		`"Rendering error: Attribute "bar" has an invalid value type: Symbol; Component stack: <div> -> <span>"`,
	);

	expect(
		render(
			<div>
				<span baz={() => "test"}></span>
			</div>,
		),
	).rejects.toThrowErrorMatchingInlineSnapshot(
		`"Rendering error: Attribute "baz" has an invalid value type: Function; Component stack: <div> -> <span>"`,
	);
});

test("renders class attribute from object", async () => {
	const result = await render(
		<div
			class={{
				foo: true,
				baz: true,
				bar: false,
			}}
		/>,
	);
	expect(result).toBe('<div class="foo baz"></div>');
});

test("renders class attribute from array", async () => {
	const result = await render(
		<div
			class={[
				"foo",
				false,
				"baz",
				0,
				{
					quux: true,
					hello: false,
				},
			]}
		/>,
	);
	expect(result).toBe('<div class="foo baz quux"></div>');
});

test("passing an invalid value to class attribute causes type error", async () => {
	// @ts-expect-error testing invalid usage
	void (<div class={Symbol()} />);
	// @ts-expect-error testing invalid usage
	void (<div class={() => null} />);
});

// https://en.reactjs.org/docs/jsx-in-depth.html#functions-as-children
test("Functions as children", async () => {
	function Repeat(props: { numTimes: number; children: (index: number) => JSXNode }) {
		const items = [];
		for (let i = 0; i < props.numTimes; i++) {
			items.push(props.children(i));
		}
		return <div>{items}</div>;
	}

	function ListOfFiveThings() {
		return <Repeat numTimes={5}>{(index) => <i>{index}</i>}</Repeat>;
	}

	const template = <ListOfFiveThings />;
	expect(await render(template)).toMatchInlineSnapshot(
		`"<div><i>0</i><i>1</i><i>2</i><i>3</i><i>4</i></div>"`,
	);
});

test("should render fragment children", async () => {
	const template = (
		<>
			<div>hello</div>
		</>
	);
	expect(await render(template)).toBe("<div>hello</div>");
});

test("should empty fragment", async () => {
	const template = <></>;
	expect(await render(template)).toBe("");
});

test("should fragment with undefined children", async () => {
	const template = <>{undefined}</>;
	expect(await render(template)).toBe("");
});

test("renders svg", async () => {
	const template = (
		<svg viewBox="0 0 100 100">
			<circle cx="0" cy="0" r="10" fill="rebeccapurple" />
		</svg>
	);
	expect(await render(template)).toBe(
		'<svg viewBox="0 0 100 100"><circle cx="0" cy="0" r="10" fill="rebeccapurple"></circle></svg>',
	);
});

test("treats key as a regular ol' prop", async () => {
	const template = <div key="foo" />;
	expect(await render(template)).toBe('<div key="foo"></div>');
});

test("isJsxElement returns true for JSX elements", async () => {
	expect(isJsxElement(<div />)).toBe(true);
	expect(isJsxElement(<span>hello</span>)).toBe(true);
	expect(isJsxElement(<>fragment</>)).toBe(true);
});

test("isJsxElement returns false for null", async () => {
	expect(isJsxElement(null)).toBe(false);
});

test("isJsxElement returns false for primitives", async () => {
	expect(isJsxElement("string")).toBe(false);
	expect(isJsxElement(42)).toBe(false);
	expect(isJsxElement(true)).toBe(false);
	expect(isJsxElement(false)).toBe(false);
	expect(isJsxElement(undefined)).toBe(false);
	expect(isJsxElement(42n)).toBe(false);
});

test("isJsxElement returns false for plain objects", async () => {
	expect(isJsxElement({})).toBe(false);
	expect(isJsxElement({ foo: "bar" })).toBe(false);
	expect(isJsxElement({ handle: () => {} })).toBe(false);
});

test("isJsxElement returns false for arrays", async () => {
	expect(isJsxElement([])).toBe(false);
	expect(isJsxElement([1, 2, 3])).toBe(false);
});

test("isJsxElement returns false for functions", async () => {
	expect(isJsxElement(() => {})).toBe(false);
	expect(isJsxElement(function () {})).toBe(false);
});
