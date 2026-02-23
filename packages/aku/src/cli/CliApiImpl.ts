import { styleText } from "node:util";
import {
	confirm as inquirerConfirm,
	input as inquirerInput,
	password as inquirerPassword,
	select as inquirerSelect,
} from "@inquirer/prompts";
import wrapAnsi from "wrap-ansi";
import { BaseClass } from "../utils.ts";
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
import { twoColumnTable } from "./two-column-table.ts";

export class CliApiImpl extends BaseClass implements CliApi {
	#getWidth(): number {
		return process.stdout.columns || 80;
	}

	p(text: string): void {
		const width = this.#getWidth();
		const wrapped = wrapAnsi(text, width, { hard: true });
		process.stdout.write(wrapped + "\n\n");
	}

	br(): void {
		process.stdout.write("\n");
	}

	h1(text: string): void {
		const styled = styleText("bold", text);
		process.stdout.write("\n" + styled + "\n\n");
	}

	h2(text: string): void {
		const styled = styleText("underline", text);
		process.stdout.write(styled + "\n\n");
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
			width: this.#getWidth(),
			leftColor: "blue",
			indent: "  ",
		});
		process.stdout.write(output);
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
			width: this.#getWidth(),
			leftColor: "blue",
			indent: "  ",
		});
		process.stdout.write(output);
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
			width: this.#getWidth(),
			leftColor: "blue",
			indent: "  ",
		});
		process.stdout.write(output);
	}

	async select<V>(options: CliSelectOptions<V>): Promise<CliPromptResponse<V>> {
		try {
			const choices = options.options.map((opt) => {
				const choice: { name: string; value: V; description?: string } = {
					name: opt.label,
					value: opt.value,
				};
				if (opt.note !== undefined) {
					choice.description = opt.note;
				}
				return choice;
			});

			const config: Parameters<typeof inquirerSelect<V>>[0] = {
				message: options.prompt,
				choices,
			};
			if (options.initialValue !== undefined) {
				config.default = options.initialValue;
			}

			const result = await inquirerSelect(config);
			return { success: true, value: result };
		} catch (error) {
			if (error instanceof Error && error.name === "ExitPromptError") {
				return { success: false };
			}
			throw error;
		}
	}

	async input<T = string>(options: CliInputOptions<T>): Promise<CliPromptResponse<T>> {
		const promptFn = options.sensitive ? inquirerPassword : inquirerInput;

		try {
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

				const result = await promptFn(config);

				if (options.parse) {
					try {
						const parsed = options.parse(result);
						return { success: true, value: parsed };
					} catch (parseError) {
						process.stdout.write((parseError as Error).message + "\n");
						continue;
					}
				}
				return { success: true, value: result as T };
			}
		} catch (error) {
			if (error instanceof Error && error.name === "ExitPromptError") {
				return { success: false };
			}
			throw error;
		}
	}

	async confirm(options: CliConfirmOptions): Promise<CliPromptResponse<boolean>> {
		try {
			const result = await inquirerConfirm({
				message: options.prompt,
				default: options.defaultValue,
			});
			return { success: true, value: result };
		} catch (error) {
			if (error instanceof Error && error.name === "ExitPromptError") {
				return { success: false };
			}
			throw error;
		}
	}
}

const normaliseDefinitionListItem = (
	item: CliDefinitionListItem,
): { label: string; definition: string } => {
	if (Array.isArray(item)) {
		return { label: item[0], definition: item[1] };
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
