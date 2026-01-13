import { BaseClass } from "../../../../utils.ts";

/**
 * @param [options.noWait] - Both brackets present
 */
export function bothBrackets(options?: { noWait?: boolean | undefined }): void {
	void options;
}

/**
 * @param [name - Opening bracket only
 */
export function openingBracketOnly(name: string): void {
	void name;
}

/**
 * @param name] - Closing bracket only
 */
export function closingBracketOnly(name: string): void {
	void name;
}

/**
 * @param options.noWait - Correct format (no errors)
 */
export function correctFormat(options?: { noWait?: boolean | undefined }): void {
	void options;
}

/**
 * Has no params - should not error.
 */
export class NoParamsClass extends BaseClass {}
