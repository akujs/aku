import { styleText } from "node:util";
import {
	confirm as inquirerConfirm,
	input as inquirerInput,
	password as inquirerPassword,
	select as inquirerSelect,
} from "@inquirer/prompts";
import wrapAnsi from "wrap-ansi";
import { BaseClass, withoutUndefinedValues } from "../utils.ts";
import type {
	CliApi,
	CliConfirmOptions,
	CliDefinitionListItem,
	CliDlOptions,
	CliInputOptions,
	CliOlOptions,
	CliOrderedListItem,
	CliPromptResponse,
	CliSelectOptions,
	CliUlOptions,
	CliUnorderedListItem,
} from "./contracts/CliApi.ts";
import { type ProcessApi, realProcessApi } from "./process-api.ts";
import { twoColumnTable } from "./two-column-table.ts";

export class CliApiImpl extends BaseClass implements CliApi {
	#proc: ProcessApi;

	constructor(proc: ProcessApi = realProcessApi) {
		super();
		this.#proc = proc;
	}

	get columns(): number {
		const env = this.#proc.getEnv("COLUMNS");
		if (env) {
			const parsed = parseInt(env, 10);
			if (parsed > 0) return parsed;
		}
		return Math.min(this.#proc.stdoutColumns(), 120);
	}

	get isInteractive(): boolean {
		return this.#proc.stdinIsTty();
	}

	async #withEscapeCancel<T>(
		fn: (context: { signal: AbortSignal }) => Promise<T>,
	): Promise<CliPromptResponse<T>> {
		if (!this.isInteractive) {
			return { success: false };
		}
		const controller = new AbortController();
		const onKeypress = (_ch: string, key: { name: string }) => {
			if (key?.name === "escape") {
				controller.abort();
			}
		};
		this.#proc.onKeypress(onKeypress);
		try {
			const value = await fn({ signal: controller.signal });
			return { success: true, value };
		} catch (error) {
			if (
				error instanceof Error &&
				(error.name === "ExitPromptError" || error.name === "AbortPromptError")
			) {
				return { success: false };
			}
			throw error;
		} finally {
			this.#proc.offKeypress(onKeypress);
		}
	}

	raw(text: string): void {
		this.#proc.stdout(text);
	}

	p(text: string): void {
		const width = this.columns;
		const wrapped = wrapAnsi(text, width, { hard: true });
		this.#proc.stdout(wrapped + "\n\n");
	}

	br(): void {
		this.#proc.stdout("\n");
	}

	h1(text: string): void {
		const styled = styleText("bold", text.toUpperCase());
		this.#proc.stdout("\n" + styled + "\n\n");
	}

	h2(text: string): void {
		const styled = styleText("underline", text);
		this.#proc.stdout(styled + "\n");
	}

	dl(options: CliDlOptions): void {
		const { items, title } = options;
		if (items.length === 0) return;

		if (title) {
			this.p(title);
		}

		const normalised = items.map(normaliseDefinitionListItem);
		const rows: Array<[string, string]> = normalised.map((item) => [item.label, item.definition]);

		const output = twoColumnTable({
			rows,
			width: this.columns,
			leftColor: "blue",
			indent: "  ",
		});
		this.#proc.stdout(output + "\n");
	}

	ul(options: CliUlOptions): void {
		const { items, title } = options;
		if (items.length === 0) return;

		if (title) {
			this.p(title);
		}

		const normalised = items.map(normaliseUnorderedListItem);
		const rows: Array<[string, string]> = normalised.map((item) => ["-", item.label]);

		const output = twoColumnTable({
			rows,
			width: this.columns,
			leftColor: "blue",
			indent: "  ",
		});
		this.#proc.stdout(output + "\n");
	}

	ol(options: CliOlOptions): void {
		const { items, title } = options;
		if (items.length === 0) return;

		if (title) {
			this.p(title);
		}

		const normalised = items.map(normaliseOrderedListItem);
		const rows: Array<[string, string]> = normalised.map((item, index) => {
			const num = item.listNumber ?? index + 1;
			return [`${num}.`, item.label];
		});

		const output = twoColumnTable({
			rows,
			width: this.columns,
			leftColor: "blue",
			indent: "  ",
		});
		this.#proc.stdout(output + "\n");
	}

	async select<V>(options: CliSelectOptions<V>): Promise<CliPromptResponse<V>> {
		return this.#withEscapeCancel((ctx) =>
			inquirerSelect(
				withoutUndefinedValues({
					message: options.prompt,
					choices: options.options.map((opt) =>
						withoutUndefinedValues({
							name: opt.label,
							value: opt.value,
							description: opt.note,
							short: opt.selectedLabel,
						}),
					),
					default: options.initialValue,
				}),
				ctx,
			),
		);
	}

	async input<T = string>(options: CliInputOptions<T>): Promise<CliPromptResponse<T>> {
		const promptFn = options.sensitive ? inquirerPassword : inquirerInput;

		while (true) {
			const config: {
				message: string;
				default?: string;
				validate?: (value: string) => boolean | string;
			} = {
				message: options.prompt,
			};
			if (options.initialValue !== undefined) {
				config.default = options.initialValue;
			}
			if (options.required) {
				config.validate = (value: string) => (value.trim() ? true : "This field is required");
			}

			const response = await this.#withEscapeCancel((ctx) => promptFn(config, ctx));
			if (!response.success) return response;

			if (options.parse) {
				try {
					const parsed = options.parse(response.value);
					return { success: true, value: parsed };
				} catch (parseError) {
					this.#proc.stdout(
						(parseError instanceof Error ? parseError.message : String(parseError)) + "\n",
					);
					continue;
				}
			}
			return { success: true, value: response.value as T };
		}
	}

	async confirm(options: CliConfirmOptions): Promise<CliPromptResponse<boolean>> {
		return this.#withEscapeCancel((ctx) =>
			inquirerConfirm(
				{
					message: options.prompt,
					default: options.defaultValue,
				},
				ctx,
			),
		);
	}
}

const normaliseDefinitionListItem = (
	item: CliDefinitionListItem,
): { label: string; definition: string } => {
	if (Array.isArray(item)) {
		return { label: item[0] ?? "", definition: item[1] ?? "" };
	}
	if (typeof item === "string") {
		return { label: item, definition: "" };
	}
	return item;
};

const normaliseUnorderedListItem = (item: CliUnorderedListItem): { label: string } => {
	if (typeof item === "string") {
		return { label: item };
	}
	return item;
};

const normaliseOrderedListItem = (
	item: CliOrderedListItem,
): { label: string; listNumber?: number | undefined } => {
	if (typeof item === "string") {
		return { label: item };
	}
	return item;
};
