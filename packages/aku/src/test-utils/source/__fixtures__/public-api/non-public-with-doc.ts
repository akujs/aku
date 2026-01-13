import { BaseClass } from "../../../../utils.ts";

// These are not re-exported from index.ts, so they're not public API
// Having doc comments without @internal should be an error

/**
 * This class shouldn't have a doc comment.
 */
export class NonPublicDocumentedClass extends BaseClass {}

/**
 * This function shouldn't have a doc comment.
 */
export function nonPublicDocumentedFunction(): void {}

/**
 * This type shouldn't have a doc comment.
 */
export type NonPublicDocumentedType = string;

/**
 * This interface shouldn't have a doc comment.
 */
export interface NonPublicDocumentedInterface {
	value: string;
}
