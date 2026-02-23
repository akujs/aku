import { AkuError } from "../core/core-errors.ts";
import { arrayWrap, describeType } from "../utils.ts";
import { type Component, ComponentInstantiator } from "./Component.ts";
import { MarkupStream, newMarkupStreamAsElement } from "./markup-stream.ts";
import type { Context, JSX, JSXNode } from "./view-types.ts";
import { tagAsJsxElement } from "./view-types.ts";

type JSXFactory = (
	// oxlint-disable-next-line no-explicit-any -- deliberate public API choice
	tag: string | Component<any>,
	props: Record<string, unknown> | null,
	key?: unknown,
) => JSX.Element;

const notProvided = Symbol();

/***/
export const jsx: JSXFactory = (tag, props, key = notProvided): JSX.Element => {
	if (key !== notProvided) {
		props ??= {};
		props.key = key;
	}
	if (typeof tag === "function") {
		let displayName: string | undefined;
		if ("displayName" in tag && typeof tag.displayName === "string") {
			displayName = tag.displayName;
		} else if (tag.name) {
			displayName = tag.name;
		}
		const callback = (ctx: Context) => {
			const instantiator = ctx.get(ComponentInstantiator);
			if (!instantiator) {
				throw new AkuError(
					"Missing ComponentInstantiator: this usually means that you are attempting to render a markup stream without going through ViewRenderer methods like render and renderResponse",
				);
			}
			return instantiator(tag, props ?? {})(ctx);
		};
		return tagAsJsxElement(new MarkupStream(null, null, callback, displayName));
	} else if (typeof tag === "string") {
		let children = null;
		if (props != null) {
			({ children, ...props } = props);
		}
		return tagAsJsxElement(
			new MarkupStream(tag, props, children == null ? null : (arrayWrap(children) as JSXNode[])),
		);
	} else {
		throw new AkuError(`Expected tag to be a string or component, got ${describeType(tag)}`);
	}
};

/** @alias */
export const jsxs: JSXFactory = jsx;

/** @alias */
export const jsxDEV: JSXFactory = jsx;

/***/
export const Fragment = (props: Record<string, unknown> | null): JSX.Element => {
	const children = props?.children ?? null;
	return newMarkupStreamAsElement(null, null, arrayWrap(children) as JSXNode[]);
};
