import { BaseClass } from "../../../../utils.ts";

export class UndocumentedClass extends BaseClass {}

export function undocumentedFunction(): void {}

export const UNDOCUMENTED_CONST = "value";
// same name as UNDOCUMENTED_CONST should only produce one error
export type UNDOCUMENTED_CONST = {};

export type UndocumentedType = string;

export interface UndocumentedInterface {
	value: string;
}
