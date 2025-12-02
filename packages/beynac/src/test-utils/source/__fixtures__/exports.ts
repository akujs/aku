import { BaseClass } from "../../../utils.ts";

// Const exports - various permutations

/** Public constant */
export const publicString = "hello";

export const noDocNumber = 42;

/** @internal Internal constant */
export const internalArray = [1, 2, 3];

// Function exports

/** Public function */
export function publicFunc() {}

export function noDocFunc() {}

/** @internal Internal function */
export function internalFunc() {}

// Class exports

/** A public class */
export class PublicClass extends BaseClass {}

export class NoDocClass extends BaseClass {}

/** @internal Internal class */
export class InternalClass extends BaseClass {}

// Interface exports

/** Public interface */
export interface PublicInterface {
	id: string;
}

/** @internal Internal interface */
export interface InternalInterface {
	value: number;
}
