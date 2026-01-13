/**
 * A function with multiple overload signatures.
 */
export function overloadedFunction(): string;
export function overloadedFunction(value: string): string;
export function overloadedFunction(value: number): string;
export function overloadedFunction(value?: string | number): string {
	if (value === undefined) {
		return "no value";
	}
	return `value: ${value}`;
}
