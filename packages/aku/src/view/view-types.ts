import type * as CSS from "csstype";
import type { Key } from "../core/Key.ts";
import type { IntrinsicElements as IntrinsicElementsDefined } from "./intrinsic-element-types.ts";

export type RenderOptions = {
	mode?: "html" | "xml" | undefined;
	context?: Context | undefined;
};

/***/
export interface Context {
	get<T>(key: Key<T>): T | null;
	set<T>(key: Key<T>, value: T): void;
}

export type JSXNode =
	| string
	| number
	| bigint
	| boolean
	| JSXNode[]
	| object
	| null
	| undefined
	| ((context: Context) => JSXNode | Promise<JSXNode>);

export const JSXElementBrand: unique symbol = Symbol.for("aku.jsx.element");

export interface JSXElement {
	readonly [JSXElementBrand]: true;
}

export function tagAsJsxElement<T>(value: T): T & JSXElement {
	// oxlint-disable-next-line no-explicit-any -- setting runtime brand on arbitrary value
	(value as any)[JSXElementBrand] = true;
	return value as T & JSXElement;
}

export function isJsxElement(value: unknown): value is JSXElement {
	return value != null && typeof value === "object" && JSXElementBrand in value;
}

/***/
export namespace JSX {
	/**
	 * The type of a <jsx></jsx> expression.
	 */
	export type Element = JSXElement | Promise<JSXElement | null> | null;

	/**
	 * The type of content items accepted within JSX: <jsx>{content}</jsx>
	 */
	export type Children = JSXNode;

	export interface ElementChildrenAttribute {
		children: Children;
	}

	export interface IntrinsicElements extends IntrinsicElementsDefined {
		[tagName: string]: Props;
	}

	export interface IntrinsicAttributes {}

	export interface ElementAttributesProperty {
		props: {};
	}

	export interface ElementClass {
		render(context: Context): Element;
	}
}

/**
 * A generic props type that accepts any props.
 */
export type Props = Record<
	string,
	// oxlint-disable-next-line no-explicit-any -- we follow react in using any here
	any
>;

/**
 * A props type for components that accept children
 *
 * @example
 * type MyProps = PropsWithChildren<{ label: string }>;
 * const MyComponent: Component<MyProps> = ({ label, children }) => <div>{label}: {children}</div>;
 */
export type PropsWithChildren<P = unknown> = P & {
	children?: JSX.Children | undefined;
};

/**
 * THe type of the `style` prop on elements
 *
 * @example
 * const red: CSSProperties = { color: "red" };
 * <div style={red} />
 */
export type CSSProperties = CSS.Properties<(string & {}) | number> & {
	[key: `--${string}`]: string | number;
};
