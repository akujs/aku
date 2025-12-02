import { BaseClass } from "../../../../utils.ts";

// These are not re-exported from the entry point, so they don't need doc comments

export class InternalClass extends BaseClass {}

export function internalFunction(): void {}

export const INTERNAL_CONST = "value";

export type InternalType = string;
