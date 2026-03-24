import type { FunctionComponent } from "./Component.ts";
import type { SpecialNode } from "./special-node.ts";
import { SPECIAL_NODE } from "./special-node.ts";
import type { JSXNode, PropsWithChildren } from "./view-types.ts";
import { tagAsJsxElement } from "./view-types.ts";

type CreateStackOptions = { displayName?: string };

/**
 * Creates a pair of components for implementing a stack pattern.
 * Content pushed with Push will be rendered at Out location.
 *
 * @returns Object with Push and Out component properties
 *
 * @example
 * ```tsx
 * const MyStack = createStack({ displayName: "MyStack" });
 *
 * <div>
 *   <MyStack.Out />
 *   <MyStack.Push>This will appear at Out location</MyStack.Push>
 * </div>
 * ```
 */
export function createStack({ displayName = "Stack" }: CreateStackOptions = {}): {
	Push: FunctionComponent<PropsWithChildren>;
	Out: FunctionComponent;
} {
	const stackIdentity = Symbol(displayName);

	const Push: FunctionComponent<PropsWithChildren> = ({ children }) => {
		return tagAsJsxElement(
			Object.assign([children], {
				stackPush: stackIdentity,
				[SPECIAL_NODE]: true,
			}),
		);
	};
	Push.displayName = `${displayName}.Push`;

	const Out: FunctionComponent<PropsWithChildren> = () => {
		return tagAsJsxElement(Object.assign([], { stackOut: stackIdentity, [SPECIAL_NODE]: true }));
	};
	Out.displayName = `${displayName}.Out`;

	return { Push, Out };
}

type StackPushNode = JSXNode[] & SpecialNode & { stackPush: symbol };

export const isStackPushNode = (node: JSXNode): node is StackPushNode =>
	typeof (node as StackPushNode)?.stackPush === "symbol";

type StackOutNode = JSXNode[] & SpecialNode & { stackOut: symbol };

export const isStackOutNode = (node: JSXNode): node is StackOutNode =>
	typeof (node as StackOutNode)?.stackOut === "symbol";
