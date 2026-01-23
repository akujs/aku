import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";

/**
 * TUI
 */
export interface Terminal {
	/**
	 * Write a paragraph of text to the terminal
	 */
	p(text: string): void;

	/**
	 * Write a big title to the terminal
	 */
	h1(text: string): void;

	/**
	 * Write a subtitle to the terminal
	 */
	h2(text: string): void;

	/**
	 * Write a definition list to the terminal. Like HTML's <dl> element, it
	 * renders a list of items with labels and definitions.
	 *
	 * Items can be objects with `label` property and `definition` properties,
	 * or arrays with two strings (treated as [label, definition] pairs).
	 *
	 * @example
	 * // Render API documentation
	 * terminal.dl([
	 *   ["makeBreakfast()", "Starts frying eggs and bacon"],
	 *   ["makeLunch()", "Toasts rye bread and tops with sliced avocado, very long descriptions will wrap, although this is not a wrap it's an open sandwich"],
	 * ]);
	 * // Renders as:
	 * // makeBreakfast()  Starts frying eggs and bacon
	 * // makeLunch()      Toasts rye bread and tops with sliced avocado, very
	 * //                  long descriptions will wrap, although this is not a
	 * //                  wrap it's an open sandwich
	 */
	dl(items: TerminalDefinitionListItem[]): void;

	/**
	 * Write a list to the terminal. Items can be strings or objects with a
	 * `label` property
	 *
	 * @example
	 * terminal.ul(["Apples", "Pears"]);
	 * // Renders as:
	 * // - Apples
	 * // - Pears
	 */
	ul(items: TerminalUnorderedListItem[]): void;

	/**
	 * Write an ordered list to the terminal. Items can be strings or objects
	 * with a `label` property and optional `listNumber` property
	 *
	 * @example
	 * terminal.ul(["Apples", "Pears"]);
	 * // Renders as:
	 * // - Apples
	 * // - Pears
	 *
	 * @example
	 * terminal.p("There are two hard problems in distributed computing:")
	 * terminal.ol([
	 *   {listNumber: 2, label: "Exactly-once delivery"},
	 *   {listNumber: 1, label: "Deterministic ordering"},
	 *   {listNumber: 2, label: "Exactly-once delivery"},
	 * ]);
	 * // Renders as:
	 * // There are two hard problems in distributed computing:
	 * // 2. Exactly-once delivery
	 * // 1. Deterministic ordering
	 * // 2. Exactly-once delivery
	 */
	ol(items: TerminalUnorderedListItem[]): void;

	dialog<O extends { label: string }>(
		options: TerminalDialogOptions<O>,
	): Promise<TerminalDialogResult<O>>;
}

export type TerminalDefinitionListItem =
	| {
			label: string;
			definition: string;
	  }
	| [string, string]
	| string[];

export type TerminalUnorderedListItem =
	| {
			label: string;
			listNumber?: number;
	  }
	| string;

export type TerminalOrderedListItem =
	| {
			label: string;
			listNumber?: number;
	  }
	| string;

	Next up: dialog -> select and confirm
export type TerminalDialogOptions<O extends { label: string }> = {
	/**
	 * Prominent text to display above the options
	 */
	title: string;

	message: string;

	/**
	 * The options to select from. Each should have a `label` property
	 */
	options: O[];
};

export type TerminalDialogResult<O extends { label: string }> = O | null;

export interface TerminalUi {
	/**
	 * Print an error message to the terminal and exit with a non-zero exit code.
	 *
	 * Use this for errors that are not bugs in your code
	 */
	fatalError(error: Error | string): never;

	/**
	 * Handle an unexpected error. This prints a message saying that the command
	 * has crashed due to a software bug, and will produce a crash report file that
	 * the user is invited to use in a bug report.
	 */
	crash(error: unknown): never;
}

export const Terminal: TypeToken<Terminal> = createTypeToken("Terminal");
