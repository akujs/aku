import { withoutComplexChars } from "./unicode.ts";

// From https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
const APA_MINOR_WORDS = [
	"a",
	"an",
	"and",
	"as",
	"at",
	"but",
	"by",
	"for",
	"from",
	"if",
	"in",
	"nor",
	"of",
	"off",
	"on",
	"or",
	"per",
	"so",
	"the",
	"to",
	"up",
	"via",
	"yet",
];

const DEFAULT_SPLIT_REGEX = new RegExp(
	[
		"[\\s\\-_]+", // Runs of spaces, hyphens, underscores (consumed)
		"(?<=[.?!])", // After sentence-ending punctuation (hello.world → hello.|world)
		"(?<=[a-z])(?=[A-Z])", // Between lowercase and uppercase (fooBar → foo|Bar)
		"(?<=[A-Z])(?=[A-Z][a-z])", // Before last cap in acronym (XMLParser → XML|Parser)
		"(?<=\\D)(?=\\d)", // Before digit (hello2 → hello|2)
		"(?<=\\d)(?=\\D)", // After digit (2world → 2|world)
	].join("|"),
);

interface SplitWordsOptions {
	splitOn?: RegExp | string | undefined;
}

/**
 * Split a string into words using various strategies
 *
 * The default behaviour is that:
 * - If string contains whitespace, assume that it is already organised into words and split by whitespace
 * - Otherwise, split on punctuation, underscores, hyphens, or case changes that indicate word boundaries, see the examples below
 *
 * @param options.splitOn - An alternative regular expression, or set of characters, to split the string on
 *
 * @example
 * // Identifier splitting (has no spaces)
 * splitWords("helloWorld") // ["hello", "World"]
 * splitWords("foo_bar-baz") // ["foo", "bar", "baz"]
 * splitWords("XMLParser") // ["XML", "Parser"] -- XML considered to be a single word
 * splitWords("hello2World") // ["hello", "2", "World"] -- numbers considered separate words to letters
 *
 * // Space splitting (has spaces)
 * splitWords("hello world") // ["hello", "world"]
 * splitWords("An amuse-bouche") // ["An", "amuse-bouche"] -- hyphens preserved
 *
 * // Custom splitting
 * splitWords("foo..bar", { splitOn: "." }) // ["foo", "bar"]
 * splitWords("a,b;c", { splitOn: /[,;]/ }) // ["a", "b", "c"]
 */
export function splitWords(str: string, options?: SplitWordsOptions): string[] {
	// Trim input
	str = str.trim();

	if (!str) return [];

	let regex: RegExp;

	if (options?.splitOn instanceof RegExp) {
		regex = options.splitOn;
	} else if (typeof options?.splitOn === "string") {
		regex = new RegExp(`[${RegExp.escape(options.splitOn)}]+`);
	} else if (/\s/.test(str)) {
		regex = /\s+/;
	} else {
		regex = DEFAULT_SPLIT_REGEX;
	}

	return str.split(regex).filter(Boolean);
}

function isMixedCase(str: string): boolean {
	const hasUpper = /[A-Z]/.test(str);
	const hasLower = /[a-z]/.test(str);
	return hasUpper && hasLower;
}

function isAllUpperCase(word: string): boolean {
	return /[A-Z]/.test(word) && !/[a-z]/.test(word);
}

interface TitleCaseOptions {
	locale?: string | undefined;
	minorWords?: string[] | boolean | undefined;
	splitOn?: RegExp | string | undefined;
	sentenceEndChars?: string[] | undefined;
}

/**
 * Convert string to title case by capitalising the first letter of words. Any
 * existing capital letters are preserved. Minor words like "of" and "the"
 * appearing in the middle of sentences are lowercased.
 *
 * @param options.locale - Locale for case conversion (default: "en")
 * @param options.minorWords - List of minor words. If true or omitted, will use APA style guide. If false, will not treat minor words specially.
 * @param options.splitOn - determine how the input string is split into words for processing, see splitWords for details
 * @param options.sentenceEndChars - Characters that mark the end of a sentence (default: ['.', '!', '?']). Words after these are always capitalised, even if they're minor words
 *
 * @example
 * titleCase("hello world") // "Hello World"
 * titleCase("a tale of two cities") // "A Tale of Two Cities"
 * titleCase("the cat and the dog") // "The Cat and the Dog"
 * titleCase("foo bar-baz") // "Foo Bar-Baz" (space present, dashes are hyphens)
 * titleCase("foo-bar-baz") // "Foo Bar Baz" (no space, dashes are separators)
 * titleCase("game on", { minorWords: false }) // "Game On"
 */
export function titleCase(str: string, options?: TitleCaseOptions): string {
	return titleSentenceHelper(str, options, true);
}

interface SentenceCaseOptions {
	locale?: string | undefined;
	sentenceEndChars?: string[] | undefined;
	splitOn?: RegExp | string | undefined;
}

/**
 * Convert string to sentence case, capitalising the first letter of each sentence
 *
 * @param options.locale - Locale for case conversion (default: "en")
 * @param options.sentenceEndChars - Characters that mark the end of a sentence (default: ['.', '!', '?'])
 * @param options.splitOn - determine how the input string is split into words for processing, see splitWords for details
 *
 * @example
 * sentenceCase("hello world") // "Hello world"
 * sentenceCase("hello world. another sentence") // "Hello world. Another sentence"
 * sentenceCase("first! second? third.") // "First! Second? Third."
 */
export function sentenceCase(str: string, options?: SentenceCaseOptions): string {
	return titleSentenceHelper(str, options, false);
}

function titleSentenceHelper(
	str: string,
	options: TitleCaseOptions | undefined,
	isTitleCase: boolean,
): string {
	const locale = options?.locale ?? "en";
	const minorWords = new Set(
		options?.minorWords === false || !isTitleCase
			? []
			: options?.minorWords === true || options?.minorWords === undefined
				? APA_MINOR_WORDS
				: options.minorWords,
	);

	const sentenceEndChars = options?.sentenceEndChars ?? [".", "!", "?"];
	const isSentenceEnd = (word: string) => sentenceEndChars.some((char) => word.endsWith(char));

	const isMixedCaseIdentifier = /^[\w-]+$/.test(str) && isMixedCase(str);

	return splitWords(str, options)
		.map((word, index, words) => {
			if (isMixedCaseIdentifier && /^[A-Z].*[a-z]/.test(word)) {
				// for PascalCase, camelCase, kebab-case, and snake_case identifiers, lowercase non-acronyms
				word = word.toLocaleLowerCase(locale);
			}
			const isFirstWord = index === 0 || isSentenceEnd(words[index - 1]);
			const isLastWord = index === words.length - 1 || isSentenceEnd(word);

			if (isTitleCase && word.includes("-")) {
				// in title case, we title-case words within hyphenated words
				word = titleCase(word.replaceAll("-", " "), options).replaceAll(" ", "-");
			}

			const isMinorWord = minorWords.has(word.toLocaleLowerCase(locale));

			const shouldCapitalise = isTitleCase
				? isFirstWord || isLastWord || !isMinorWord
				: isFirstWord;

			if (shouldCapitalise) {
				return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1);
			}
			return isMinorWord ? word.toLocaleLowerCase(locale) : word;
		})
		.join(" ");
}

interface SnakeCaseOptions {
	locale?: string | undefined;
	case?: "lower" | "upper" | "preserve" | undefined;
	splitOn?: RegExp | string | undefined;
}

/**
 * Convert string to snake_case
 *
 * @param str - Input string
 * @param options.locale - Locale for case conversion (default: "en")
 * @param options.case - Case style for output: "upper", "lower" or "preserve"
 * @param options.splitOn - determine how the input string is split into words for processing, see splitWords for details
 *
 * @example
 * snakeCase("helloWorld") // "hello_world"
 * snakeCase("Hello World") // "hello_world"
 * snakeCase("shoutySnakeCase", { case: "upper" }) // "SHOUTY_SNAKE_CASE"
 * snakeCase("helloWorld", { case: "preserve" }) // "hello_World"
 */
export function snakeCase(str: string, options?: SnakeCaseOptions): string {
	const locale = options?.locale ?? "en";
	const caseStyle = options?.case ?? "lower";

	let result = withoutComplexChars(splitWords(str, options).join("_"), { target: "identifier" });

	switch (caseStyle) {
		case "upper":
			return result.toLocaleUpperCase(locale);
		case "lower":
			return result.toLocaleLowerCase(locale);
		default:
			return result;
	}
}

interface CaseOptions {
	locale?: string | undefined;
	splitOn?: RegExp | string | undefined;
}

/**
 * Convert string to PascalCase
 *
 * @param options.locale - Locale for case conversion (default: "en")
 * @param options.splitOn - determine how the input string is split into words for processing, see splitWords for details
 *
 * @example
 * pascalCase("hello world") // "HelloWorld"
 * pascalCase("hello_world") // "HelloWorld"
 * pascalCase("hello-world") // "HelloWorld"
 * pascalCase("Sentence with, some punctuation!") // "SentenceWithSomePunctuation"
 */
export function pascalCase(str: string, options?: CaseOptions): string {
	return camelPascalHelper(str, options, false);
}

/**
 * Convert string to camelCase
 *
 * @param options.locale - Locale for case conversion (default: "en")
 * @param options.splitOn - determine how the input string is split into words for processing, see splitWords for details
 *
 * @example
 * camelCase("hello world") // "helloWorld"
 * camelCase("hello_world") // "helloWorld"
 * camelCase("HelloWorld") // "helloWorld"
 * camelCase("Sentence with, some punctuation!") // "sentenceWithSomePunctuation"
 */
export function camelCase(str: string, options?: CaseOptions): string {
	return camelPascalHelper(str, options, true);
}

function camelPascalHelper(
	str: string,
	options: CaseOptions | undefined,
	isCamel: boolean,
): string {
	const locale = options?.locale ?? "en";
	const mixedCase = isMixedCase(str);
	const joinedWords = splitWords(str, options)
		.map((word, index) => {
			if (isCamel && index === 0) {
				return word.toLocaleLowerCase(locale);
			}
			if (mixedCase && isAllUpperCase(word)) {
				return word;
			}
			return word.charAt(0).toLocaleUpperCase(locale) + word.slice(1).toLocaleLowerCase(locale);
		})
		.join("");
	return withoutComplexChars(joinedWords, { target: "identifier" });
}

/**
 * Convert string to kebab-case
 *
 * @param options.locale - Locale for case conversion (default: "en")
 * @param options.splitOn - determine how the input string is split into words for processing, see splitWords for details
 *
 * @example
 * kebabCase("helloWorld") // "hello-world"
 * kebabCase("HelloWorld") // "hello-world"
 * kebabCase("hello world") // "hello-world"
 */
export function kebabCase(str: string, options?: CaseOptions): string {
	const locale = options?.locale ?? "en";
	const words = splitWords(str, { splitOn: options?.splitOn });
	return words.map((word) => word.toLocaleLowerCase(locale)).join("-");
}

/**
 * Convert string to sTuDlY cAsE with random capitalisation. Each call will
 * produce different output because the implementation uses Math.random() to
 * determine case.
 *
 * @param options.locale - Locale for case conversion (default: "en")
 *
 * @example
 * studlyCase("hello world") // "HeLLo WoRLd" (random)
 * studlyCase("hello_world") // "HeLLo_WoRLd" (random)
 */
export function studlyCase(str: string, options?: { locale?: string | undefined }): string {
	const locale = options?.locale ?? "en";
	return Array.from(str)
		.map((char) => {
			if (Math.random() > 0.5) {
				return char.toLocaleUpperCase(locale);
			}
			return char.toLocaleLowerCase(locale);
		})
		.join("");
}

/**
 * Capitalise the first character of a string
 *
 * @param str - Input string
 * @param options - Conversion options
 * @param options.locale - Locale for case conversion (default: "en")
 * @returns String with first character capitalised
 *
 * @example
 * uppercaseFirst("hello world") // "Hello world"
 * uppercaseFirst("hello_world") // "Hello_world"
 */
export function uppercaseFirst(str: string, options?: CaseOptions): string {
	const locale = options?.locale ?? "en";
	if (!str) return str;
	return str.charAt(0).toLocaleUpperCase(locale) + str.slice(1);
}

/**
 * Lowercase the first character of a string
 *
 * @param str - Input string
 * @param options - Conversion options
 * @param options.locale - Locale for case conversion (default: "en")
 * @returns String with first character lowercased
 *
 * @example
 * lowercaseFirst("Hello World") // "hello World"
 * lowercaseFirst("Hello_World") // "hello_World"
 */
export function lowercaseFirst(str: string, options?: CaseOptions): string {
	const locale = options?.locale ?? "en";
	if (!str) return str;
	return str.charAt(0).toLocaleLowerCase(locale) + str.slice(1);
}

/**
 * Convert a string to uppercase
 *
 * @param str - Input string
 * @param options - Conversion options
 * @param options.locale - Locale for case conversion (default: "en")
 * @returns String in uppercase
 *
 * @example
 * uppercase("hello world") // "HELLO WORLD"
 * uppercase("hello_world") // "HELLO_WORLD"
 */
export function uppercase(str: string, options?: CaseOptions): string {
	const locale = options?.locale ?? "en";
	return str.toLocaleUpperCase(locale);
}

/**
 * Convert entire string to lowercase
 *
 * @param str - Input string
 * @param options - Conversion options
 * @param options.locale - Locale for case conversion (default: "en")
 * @returns String in lowercase
 *
 * @example
 * lowercase("HELLO WORLD") // "hello world"
 * lowercase("Hello_World") // "hello_world"
 */
export function lowercase(str: string, options?: CaseOptions): string {
	const locale = options?.locale ?? "en";
	return str.toLocaleLowerCase(locale);
}
