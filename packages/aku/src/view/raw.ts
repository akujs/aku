import { BaseClass } from "../utils.ts";
import { SPECIAL_NODE } from "./special-node.ts";
import type { JSXElement } from "./view-types.ts";
import { tagAsJsxElement } from "./view-types.ts";

export class RawContent extends BaseClass {
	#content: string;

	constructor(content: string) {
		super();
		this.#content = content;
		Object.assign(this, { [SPECIAL_NODE]: true });
		tagAsJsxElement(this);
	}

	override toString(): string {
		return this.#content;
	}

	[Symbol.toPrimitive](): string {
		return this.#content;
	}
}

/**
 * Render a raw string directly in the document, for example to include
 * pre-rendered HTML or a block of javascript.
 *
 * Can be used within JSX and html`` templates.
 *
 * @example
 * <div>{raw(renderMarkdownToHtml(markdown))}</div>
 */
export function raw(content: string): JSXElement {
	return new RawContent(content) as unknown as JSXElement;
}
