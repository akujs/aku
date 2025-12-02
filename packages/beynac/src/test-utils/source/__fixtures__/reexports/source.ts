import { BaseClass } from "../../../../utils.ts";

// Value exports for re-export testing
export class OriginalClass extends BaseClass {}

export const originalValue = "original";

export function originalFunc() {}

// Type exports for re-export testing
export interface OriginalInterface {
	id: string;
}

export type OriginalType = {
	value: number;
};
