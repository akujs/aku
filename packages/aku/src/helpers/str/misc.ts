export type Replacer = (input: string) => string;

/**
 * Format a number as an ordinal string (1st, 2nd, 3rd, etc.).
 *
 * @example
 * formatOrdinal(1);   // "1st"
 * formatOrdinal(2);   // "2nd"
 * formatOrdinal(3);   // "3rd"
 * formatOrdinal(11);  // "11th"
 * formatOrdinal(21);  // "21st"
 */
export function formatOrdinal(n: number): string {
	const abs = Math.abs(n);
	const lastTwo = abs % 100;

	// 11th, 12th, 13th are exceptions
	if (lastTwo >= 11 && lastTwo <= 13) {
		return `${n}th`;
	}

	const lastOne = abs % 10;
	switch (lastOne) {
		case 1:
			return `${n}st`;
		case 2:
			return `${n}nd`;
		case 3:
			return `${n}rd`;
		default:
			return `${n}th`;
	}
}

/**
 * Create a function that efficiently replaces keys with their corresponding values in a string.
 *
 * Compiles the keys into a regular expression, which for large dictionaries is more efficient than using multiple replace calls.
 *
 * @example
 * const replace = stringCompileMultiReplace({ a: "1", b: "2" });
 * console.log(replace("a + b")); // Output: "1 + 2"
 */
export const stringCompileMultiReplace = (replacements: Record<string, string>): Replacer => {
	const keys = Object.keys(replacements);
	// Sort by length descending to match longer keys first
	keys.sort((a, b) => b.length - a.length);
	const escapedKeys = keys.map((key) => RegExp.escape(key));
	const keyRegex = new RegExp(escapedKeys.join("|"), "g");
	return (str: string) => str.replace(keyRegex, (match) => replacements[match] ?? "");
};

/**
 * Replaces keys with their corresponding values in a string.
 *
 * If you'll be doing a replacement with the same dictionary multiple times it
 * is more efficient to use {@link stringCompileMultiReplace}
 *
 * @example
 * stringMultiReplace("a + b", { a: "1", b: "2" });  // Output: "1 + 2"
 */
export const stringMultiReplace = (input: string, replacements: Record<string, string>): string => {
	return stringCompileMultiReplace(replacements)(input);
};
