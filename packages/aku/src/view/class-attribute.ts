export type ClassAttributeValue =
	| string
	| number
	| boolean
	| undefined
	| null
	| Record<string, unknown>
	| ClassAttributeValue[];

export function classAttribute(...inputs: ClassAttributeValue[]): string {
	let result = "";
	let needSpace = false;

	/**
	 * Appends a value to the result buffer with proper spacing
	 */
	function append(value: string): void {
		if (value) {
			if (needSpace) {
				result += " ";
			}
			result += value;
			needSpace = true;
		}
	}

	function processValue(value: ClassAttributeValue): void {
		if (!value) return;

		if (typeof value === "string") {
			append(value);
		} else if (typeof value === "number") {
			append(String(value));
		} else if (Array.isArray(value)) {
			for (const item of value) {
				processValue(item);
			}
		} else if (typeof value === "object") {
			for (const [key, val] of Object.entries(value)) {
				if (val) {
					append(key);
				}
			}
		}
	}

	for (const input of inputs) {
		processValue(input);
	}

	return result;
}
