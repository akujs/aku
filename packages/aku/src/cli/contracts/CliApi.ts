import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";

/**
 * CLI API - text user interface for command-line applications
 */
export interface CliApi {
	/**
	 * Write a paragraph of text
	 *
	 * TODO: wrap with wrap-ansi, add wrap-ansi dev dependency using compatible version to @enquirer/prompts dependency
	 * TODO: add an empty line below only
	 */
	p(text: string): void;

	/**
	 * Write an empty line
	 */
	br(): void;

	/**
	 * Write a big title
	 *
	 * TODO: use the node styleText utility to make this bold
	 * TODO: add a line break above and below
	 */
	h1(text: string): void;

	/**
	 * Write a subtitle
	 *
	 * TODO use styleText to make this underlined
	 * TODO: add an empty line below only
	 */
	h2(text: string): void;

	/**
	 * Write a definition list. Like HTML's <dl> element, it
	 * renders a list of items with labels and definitions.
	 *
	 * Items can be objects with `label` and `definition` properties, or arrays
	 * with two strings (treated as [label, definition] pairs).
	 *
	 * TODO: render descriptions as a 2 column table as in the example below
	 * TODO: wrap descriptions using wrap-ansi and indent as per example below
	 * TODO: don't allow descriptions to go above half the output width, truncate with ...
	 * TODO: use styleText to make the descriptions blue
	 * TODO: create a twoColumnTable utility to handle this, takes an option of the color for the left column, wraps the right column with wrap-ansi, and determines the width of the left column using the stripVTControlCharacters util from node
	 *
	 * @param options.items The items to display
	 * @param options.title Optional title to display above the list
	 *
	 * @example
	 * // Render API documentation
	 * cli.dl({
	 *   items: [
	 *     ["makeBreakfast()", "Starts frying eggs and bacon"],
	 *     ["makeLunch()", "Toasts rye bread and tops with sliced avocado, very long descriptions will wrap, although this is not a wrap it's an open sandwich"],
	 *   ],
	 * });
	 * // Renders as:
	 * // makeBreakfast()  Starts frying eggs and bacon
	 * // makeLunch()      Toasts rye bread and tops with sliced avocado, very
	 * //                  long descriptions will wrap, although this is not a
	 * //                  wrap it's an open sandwich
	 */
	dl(options: CliDlOptions): void;

	/**
	 * Write an unordered list. Items can be strings or objects with a
	 * `label` property
	 *
	 * TODO: use styleText to make the bullets blue
	 * TODO: use twoColumnTable utility
	 *
	 * @param options.items The items to display
	 * @param options.title Optional title to display above the list
	 *
	 * @example
	 * cli.ul({ items: ["Apples", "Pears"] });
	 * // Renders as:
	 * // - Apples
	 * // - Pears
	 */
	ul(options: CliUlOptions): void;

	/**
	 * Write an ordered list. Items can be strings or objects
	 * with a `label` property and optional `listNumber` property
	 *
	 * TODO: use styleText to make the numbers blue
	 * TODO: use twoColumnTable utility
	 *
	 * @param options.items The items to display
	 * @param options.title Optional title to display above the list
	 *
	 * @example
	 * cli.ol({ items: ["Apples", "Pears"] });
	 * // Renders as:
	 * // 1. Apples
	 * // 2. Pears
	 *
	 * @example
	 * cli.ol({
	 *   title: "There are two hard problems in distributed computing:",
	 *   items: [
	 *     {listNumber: 2, label: "Exactly-once delivery"},
	 *     {listNumber: 1, label: "Deterministic ordering"},
	 *     {listNumber: 2, label: "Exactly-once delivery"},
	 *   ],
	 * });
	 * // Renders as:
	 * // There are two hard problems in distributed computing:
	 * // 2. Exactly-once delivery
	 * // 1. Deterministic ordering
	 * // 2. Exactly-once delivery
	 */
	ol(options: CliOlOptions): void;

	/**
	 * Choose one option from a list. Renders an interactive UI to display
	 * options as a list and allow selecting one with the up, down and enter
	 * keys.
	 *
	 * TODO: use select from @inquirer/prompts
	 *
	 * @param options.prompt Question to display above the choice list
	 * @param options.options The options to select from
	 * @param options.initialValue Initially selected option (compared using `===`)
	 *
	 * @example
	 * cli.select({
	 *   prompt: "What do you want to do?",
	 *   options: [
	 *     {label: "Make a cup of tea", value: "make-tea"},
	 *     {label: "Make a cup of coffee", value: "make-coffee"},
	 *   ],
	 * });
	 */
	select<V>(options: CliSelectOptions<V>): Promise<CliPromptResponse<V>>;

	/**
	 * Prompt for user input
	 *
	 * TODO: use input from @inquirer/prompts
	 *
	 * @param options.prompt Text to display above the input
	 * @param options.initialValue Pre-populated value that can be edited by the user
	 * @param options.required Whether empty input is rejected
	 * @param options.sensitive Hide input for sensitive data like passwords or API keys
	 * @param options.parse Parse and validate the input, throw an Error to display a validation message and retry
	 */
	input<T = string>(options: CliInputOptions<T>): Promise<CliPromptResponse<T>>;

	/**
	 * Prompt for yes/no confirmation
	 *
	 * TODO: use confirm from @inquirer/prompts
	 *
	 * @param options.prompt Text to display, e.g. "Are you sure you want to delete this file?"
	 * @param options.defaultValue Value returned if user presses enter without typing y or n
	 */
	confirm(options: CliConfirmOptions): Promise<CliPromptResponse<boolean>>;
}

export type CliDefinitionListItem =
	| {
			label: string;
			definition: string;
	  }
	| [string, string]
	| string[];

export type CliUnorderedListItem =
	| {
			label: string;
	  }
	| string;

export type CliOrderedListItem =
	| {
			label: string;
			listNumber?: number;
	  }
	| string;

export type CliDlOptions = {
	/**
	 * The items to display
	 */
	items: CliDefinitionListItem[];

	/**
	 * Optional title to display above the list
	 */
	title?: string | undefined;
};

export type CliUlOptions = {
	/**
	 * The items to display
	 */
	items: CliUnorderedListItem[];

	/**
	 * Optional title to display above the list
	 */
	title?: string | undefined;
};

export type CliOlOptions = {
	/**
	 * The items to display
	 */
	items: CliOrderedListItem[];

	/**
	 * Optional title to display above the list
	 */
	title?: string | undefined;
};

export type CliPromptResponse<V> =
	| {
			success: true;
			value: V;
	  }
	| {
			success: false;
	  };

export type CliSelectChoice<V> = {
	/**
	 * Text to display for this item in the list of choices
	 */
	label: string;

	/**
	 * Value returned when this choice is selected
	 */
	value: V;

	/**
	 * Extended text shown when this item is highlighted
	 */
	note?: string | undefined;

	/**
	 * Text displayed representing the selected option after the selection is confirmed (defaults to label)
	 */
	selectedLabel?: string | undefined;
};

export type CliSelectOptions<V> = {
	/**
	 * Question to display above the choice list, e.g. "What do you want to do?"
	 */
	prompt: string;

	/**
	 * The options to select from
	 */
	options: ReadonlyArray<CliSelectChoice<V>>;

	/**
	 * Initially selected option. This must be exactly equal (compared using
	 * `===`) to one of the options, otherwise it will be ignored.
	 */
	initialValue?: V | undefined;
};

export type CliInputOptions<T> = {
	/**
	 * Text to display above the input
	 */
	prompt: string;

	/**
	 * Pre-populated value that can be edited by the user
	 */
	initialValue?: string | undefined;

	/**
	 * Whether empty input is rejected
	 */
	required?: boolean | undefined;

	/**
	 * Hide input for sensitive data like passwords or API keys
	 */
	sensitive?: boolean | undefined;

	/**
	 * Parse and validate the input. If omitted, returns the raw string (T must be string).
	 *
	 * Throw an Error to display a validation message (taken from error.message) and retry.
	 */
	parse?: ((value: string) => T) | undefined;
};

export type CliConfirmOptions = {
	/**
	 * Text to display, e.g. "Are you sure you want to delete this file?"
	 */
	prompt: string;

	/**
	 * Value returned if user presses enter without typing y or n
	 */
	defaultValue: boolean;
};

export const CliApi: TypeToken<CliApi> = createTypeToken("CliApi");
