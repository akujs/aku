import { mapObjectValues } from "../../utils.ts";
import type { Replacer } from "./misc.ts";
import { compileMultiReplace, multiReplace } from "./misc.ts";
import { unicodeReplacements } from "./replacements.ts";

/**
 * Remove unicode combining marks and ligatures from a string.
 *
 * This function handles accents and diacritics, but - unlike transliterate() -
 * does not go as far as language-aware replacements like German "ß" to "ss"
 *
 * @param [options.allowLatin1] - If true, preserve ISO-8859-1 characters like é
 *
 * @example
 * withoutMarks('Crème Brûlée') // 'Creme Brulee'
 * withoutMarks('café') // 'cafe'
 * withoutMarks('café', { allowLatin1: true }) // 'café' (é preserved as Latin1)
 */
export function withoutMarks(value: string, options?: { allowLatin1?: boolean }): string {
	if (!options?.allowLatin1) {
		return value.normalize("NFKD").replace(/\p{M}/gu, "");
	}

	// Preserve ISO-8859-1 characters, decompose only non-Latin1 sequences
	const result = value.normalize("NFC");
	return result
		.replace(/[^\x20-\x7e\xa0-\xff]+/gu, (match) => {
			// Only decompose non-Latin1 sequences
			return match.normalize("NFKD").replace(/\p{M}/gu, "");
		})
		.normalize("NFC"); // Re-compose (mainly for Hangul)
}

/**
 * Transliterate Unicode characters to their ASCII equivalents
 *
 * Use this when you need to convert text to the most sane representation that can be expressed in ASCII
 *
 * @param value - String to transliterate
 * @param options.allowLatin1 - If true, preserve ISO-8859-1 characters like é
 * @returns Transliterated string with multi-character ASCII replacements and marks removed
 *
 * @example
 * transliterate('Größe') // 'Groesse' (ß→ss, ö→oe, then marks removed)
 * transliterate('æther') // 'aether' (æ→ae)
 * transliterate('💯') // '100'
 * transliterate('€50') // 'E50'
 * transliterate('подъезд') // 'podyezd' (Cyrillic→Latin)
 * transliterate('café') // 'cafe' (é→e)
 * transliterate('café', { allowLatin1: true }) // 'café' (é preserved as Latin1)
 */
export function transliterate(value: string, options?: { allowLatin1?: boolean }): string {
	unicodeReplacer ??= compileMultiReplace(unicodeReplacements);
	let result = unicodeReplacer(value);
	result = result.replaceAll(/\p{Dash_Punctuation}/gu, "-");
	result = withoutMarks(result, options);
	return result;
}
let unicodeReplacer: Replacer | undefined;

/**
 * Remove or replace non-ASCII characters from a string.
 *
 * Alternatively, provide `options.target` to specify different characters to remove:
 *
 * - `"ascii"`: Preserve printable ASCII characters (default).
 * - `"url"`: Preserve url-safe characters - only allow letters, numbers, hyphens, underscores, periods, and tildes.
 * - `"latin1"`: Preserve printable ISO-8859-1 characters (all ASCII characters, plus 0xA0-0xFF like é, ñ, ü)
 * - `"identifier"`: Remove non-ASCII characters and replace spaces with underscores.
 *
 * @param options.target - "ascii", "url", "latin1", "identifier"
 * @param options.replacement - String to replace invalid characters with (default: "")
 *
 * @example
 * withoutComplexChars('café') // 'caf' (é removed)
 * withoutComplexChars('café', { allowLatin1: true }) // 'café' (é preserved)
 * withoutComplexChars('北京', { replacement: '?' }) // '??' (CJK replaced)
 */
export function withoutComplexChars(
	value: string,
	options?: {
		target?: "ascii" | "url" | "latin1" | "identifier";
		replacement?: string;
	},
): string {
	const { target, replacement = "" } = options || {};

	switch (target) {
		case "url":
			return value.replace(/[^\w\-.~]/g, replacement);
		case "latin1":
			return value.replace(/[^\x20-\x7e\xa0-\xff]/g, replacement);
		case "identifier":
			return value.replace(/[^\w]/g, replacement);
		default:
			return value.replace(/[^\x20-\x7e]/g, replacement);
	}
}

export interface SlugOptions {
	separator?: string;
	replacements?: Record<string, string> | boolean;
	lowercase?: boolean;
}

/**
 * Generate a URL-friendly slug from a string
 *
 * Applies Unicode normalisation (transliterate → withoutMarks → withoutComplexChars) to convert
 * all characters to ASCII, then creates a URL-safe slug with only unreserved characters.
 *
 * @param [options.separator] - Separator character (default: "-")
 * @param [options.replacements] - Character replacements (default: { '@': 'at', '&': 'and', '%': 'percent', '+': 'plus' })
 *   - Record<string, string>: Custom replacements (replaces default entirely)
 *   - true: Use default dictionary
 *   - false: Disable replacements
 * @param [options.lowercase] - Convert to lowercase (default: true)
 *
 * @example
 * slug('Größe café') // 'groesse-cafe'
 * slug('hello  world') // 'hello-world'
 * slug('email@example') // 'email-at-example'
 * slug('Tom & Jerry') // 'tom-and-jerry'
 * slug('100%') // '100-percent'
 * slug('hello world', { separator: '_' }) // 'hello_world'
 * slug('100%', { replacements: { '%': 'pct' } }) // '100-pct'
 * slug('café!', { replacements: false }) // 'cafe' (! removed, no replacements)
 * slug('Hello', { lowercase: false }) // 'Hello'
 */
export function slug(title: string, options: SlugOptions = {}): string {
	let { separator = "-", replacements = true, lowercase = true } = options;

	let result = title;

	if (replacements !== false) {
		if (replacements === true) {
			replacements = { "@": "at", "&": "and", "%": "percent", "+": "plus" };
		}
		replacements = mapObjectValues(replacements, (value) => ` ${value} `);

		result = multiReplace(result, replacements);
	}

	result = transliterate(result);
	result = withoutComplexChars(result);
	if (lowercase) {
		result = result.toLowerCase();
	}

	result = result
		// Replace inter-word marks with space, these typically separate words/phrases
		.replace(/[—–;/\\|:.?!<>]/g, " ")
		.trim()
		.replace(/\s+/g, separator);

	return withoutComplexChars(result, { target: "url" });
}
