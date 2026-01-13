import type { FunctionComponent } from "./Component.ts";
import type { SpecialNode } from "./special-node.ts";
import { SPECIAL_NODE } from "./special-node.ts";
import type { JSXNode, PropsWithChildren } from "./view-types.ts";
import { tagAsJsxElement } from "./view-types.ts";

export type OnceKey = string | number | symbol | bigint;

export type OnceNode = JSXNode[] & SpecialNode & { onceKey: OnceKey };

export const isOnceNode = (node: JSXNode): node is OnceNode =>
	typeof (node as OnceNode)?.onceKey !== "undefined";

type OnceProps = PropsWithChildren<{ key: OnceKey }>;

type OnceComponent = FunctionComponent<OnceProps> & {
	createComponent: (key?: OnceKey) => FunctionComponent<PropsWithChildren>;
};

const OnceImpl: FunctionComponent<OnceProps> = ({ children, key }) => {
	return tagAsJsxElement(Object.assign([children], { onceKey: key, [SPECIAL_NODE]: true }));
};

let anonOnceCounter = 0;

const createComponent = (key: OnceKey = Symbol(`once-${++anonOnceCounter}`)) => {
	const component: FunctionComponent<PropsWithChildren> = ({ children }) => {
		return tagAsJsxElement(Object.assign([children], { onceKey: key, [SPECIAL_NODE]: true }));
	};
	const name = (typeof key === "symbol" ? key.description : String(key)) || "anonymous";
	component.displayName = `Once(${name})`;
	return component;
};

export const Once: OnceComponent = Object.assign(OnceImpl, {
	createComponent,
});
