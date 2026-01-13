import { arrayWrap, BaseClass } from "../utils.ts";
import type { JSXElement } from "./view-types.ts";
import { type JSXNode, tagAsJsxElement } from "./view-types.ts";

export class MarkupStream extends BaseClass {
	readonly tag: string | null;
	readonly displayName: string | null;
	readonly attributes: Record<string, unknown> | null;
	readonly content: JSXNode[] | null;

	constructor(
		tag: string | null,
		attributes: Record<string, unknown> | null,
		children: JSXNode,
		displayName?: string | null,
	) {
		super();
		this.tag = tag;
		this.attributes = attributes;
		this.content = children == null ? null : arrayWrap(children);
		this.displayName = displayName ?? tag ?? null;
		tagAsJsxElement(this);
	}
}

// factory function with correct typing - MarkupStream isn't recognised as an Element because the tag is set dynamically in the constructor
export const newMarkupStreamAsElement = (
	tag: string | null,
	attributes: Record<string, unknown> | null,
	children: JSXNode,
	displayName?: string | null,
): JSXElement => new MarkupStream(tag, attributes, children, displayName) as unknown as JSXElement;
