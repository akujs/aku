export const SPECIAL_NODE: unique symbol = Symbol("special-node");

export type SpecialNode = { [SPECIAL_NODE]: unknown };

export const isSpecialNode = (node: unknown): boolean =>
	(node as SpecialNode)?.[SPECIAL_NODE] != null;
