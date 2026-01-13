import { arrayWrap } from "../utils.ts";
import type { JSXNode } from "./view-types.ts";

/**
 * Converts JSX children to an array, filtering out null, undefined, and boolean values.
 * Similar to React's Children.toArray utility.
 */
export function childrenToArray(children: JSXNode): JSXNode[] {
	const wrapped = arrayWrap(children);
	return wrapped.filter(
		(child): child is Exclude<JSXNode, null | undefined | boolean> =>
			child != null && typeof child !== "boolean",
	);
}
