import { BaseClass } from "../../../../utils.ts";

/**
 * A documented class that should pass validation.
 */
export class DocumentedClass extends BaseClass {}

/**
 * A documented function that should pass validation.
 */
export function documentedFunction(): void {}

/**
 * A documented constant that should pass validation.
 */
export const DOCUMENTED_CONST = "value";

/**
 * A documented type that should pass validation.
 */
export type DocumentedType = string;

/**
 * A documented interface that should pass validation.
 */
export interface DocumentedInterface {
	value: string;
}
