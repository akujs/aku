import type { Application } from "../core/contracts/Application.ts";
import { BaseClass } from "../utils.ts";
import type { CliConfirmOptions, CliInputOptions, CliSelectOptions } from "./contracts/CliApi.ts";
import { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import {
	type CapturedError,
	type CliOutput,
	MemoryCliApi,
	type PendingPrompt,
} from "./MemoryCliApi.ts";

export function tokeniseCommand(input: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let hasToken = false;
	let i = 0;

	while (i < input.length) {
		const ch = input[i];

		if (ch === "'") {
			hasToken = true;
			i++;
			const start = i;
			while (i < input.length && input[i] !== "'") {
				i++;
			}
			if (i >= input.length) {
				throw new Error("Unclosed single quote");
			}
			current += input.slice(start, i);
			i++; // skip closing '
		} else if (ch === '"') {
			hasToken = true;
			i++;
			while (i < input.length && input[i] !== '"') {
				if (input[i] === "\\" && i + 1 < input.length) {
					const next = input[i + 1];
					if (next === "\\" || next === '"') {
						current += next;
						i += 2;
						continue;
					}
				}
				current += input[i];
				i++;
			}
			if (i >= input.length) {
				throw new Error("Unclosed double quote");
			}
			i++; // skip closing "
		} else if (ch === "\\") {
			hasToken = true;
			i++;
			if (i < input.length) {
				current += input[i];
				i++;
			}
		} else if (ch === " " || ch === "\t") {
			if (hasToken) {
				tokens.push(current);
				current = "";
				hasToken = false;
			}
			i++;
		} else {
			hasToken = true;
			current += ch;
			i++;
		}
	}

	if (hasToken) {
		tokens.push(current);
	}

	return tokens;
}

export class CliTestHarness extends BaseClass {
	#app: Application;
	#cli: MemoryCliApi;

	constructor(app: Application) {
		super();
		this.#app = app;
		this.#cli = new MemoryCliApi();
		app.container.singletonInstance(CliErrorHandler, this.#cli);
	}

	get output(): string {
		return renderCliOutputAsMarkdown(this.#cli.outputs);
	}

	get errors(): CapturedError[] {
		return this.#cli.errors;
	}

	get lastError(): CapturedError | undefined {
		return this.#cli.lastError;
	}

	reset(): void {
		this.#cli.reset();
	}

	/**
	 * Run a CLI command and return the exit code. Resets output and errors before each call.
	 */
	run(args: string[] | string): Promise<number> {
		const resolved = typeof args === "string" ? tokeniseCommand(args) : args;
		this.reset();
		return this.#app.handleCommand(resolved, this.#cli);
	}

	/**
	 * Wait for a select prompt and answer it with a value, or cancel it.
	 */
	async answerSelect(
		valueOrOptions: unknown,
		options?: { timeout?: number | undefined },
	): Promise<void> {
		if (isCancelOptions(valueOrOptions)) {
			const prompt = await this.#nextPromptOfType("select", valueOrOptions.timeout);
			prompt.respond({ success: false });
			return;
		}

		const prompt = await this.#nextPromptOfType("select", options?.timeout);
		const selectOpts = prompt.options as CliSelectOptions<unknown>;
		const value =
			typeof valueOrOptions === "function"
				? (valueOrOptions as (opts: CliSelectOptions<unknown>) => unknown)(selectOpts)
				: valueOrOptions;

		const valid = selectOpts.options.some((opt) => opt.value === value);
		if (!valid) {
			throw new Error(
				`Value ${JSON.stringify(value)} is not a valid option. Valid options: ${selectOpts.options.map((o) => JSON.stringify(o.value)).join(", ")}`,
			);
		}

		prompt.respond({ success: true, value });
	}

	/**
	 * Wait for an input prompt and answer it with a string, or cancel it.
	 */
	async answerInput(
		valueOrOptions:
			| string
			| ((opts: CliInputOptions<unknown>) => string)
			| { cancel: true; timeout?: number | undefined },
		options?: { timeout?: number | undefined },
	): Promise<void> {
		if (isCancelOptions(valueOrOptions)) {
			const prompt = await this.#nextPromptOfType("input", valueOrOptions.timeout);
			prompt.respond({ success: false });
			return;
		}

		const prompt = await this.#nextPromptOfType("input", options?.timeout);
		const inputOpts = prompt.options as CliInputOptions<unknown>;
		const rawValue =
			typeof valueOrOptions === "function"
				? (valueOrOptions as (opts: CliInputOptions<unknown>) => string)(inputOpts)
				: valueOrOptions;

		if (inputOpts.required && rawValue.trim() === "") {
			throw new Error("Input is required but received an empty string");
		}

		const value = inputOpts.parse ? inputOpts.parse(rawValue) : rawValue;

		prompt.respond({ success: true, value });
	}

	/**
	 * Wait for a confirm prompt and answer it with a boolean, or cancel it.
	 */
	async answerConfirm(
		valueOrOptions:
			| boolean
			| ((opts: CliConfirmOptions) => boolean)
			| { cancel: true; timeout?: number | undefined },
		options?: { timeout?: number | undefined },
	): Promise<void> {
		if (isCancelOptions(valueOrOptions)) {
			const prompt = await this.#nextPromptOfType("confirm", valueOrOptions.timeout);
			prompt.respond({ success: false });
			return;
		}

		const prompt = await this.#nextPromptOfType("confirm", options?.timeout);
		const confirmOpts = prompt.options as CliConfirmOptions;
		const value =
			typeof valueOrOptions === "function"
				? (valueOrOptions as (opts: CliConfirmOptions) => boolean)(confirmOpts)
				: valueOrOptions;

		prompt.respond({ success: true, value });
	}

	async #nextPromptOfType(
		expectedType: PendingPrompt["type"],
		timeout?: number,
	): Promise<PendingPrompt> {
		const prompt = await this.#cli.nextPrompt(timeout !== undefined ? { timeout } : undefined);
		if (prompt.type !== expectedType) {
			throw new Error(`Expected a ${expectedType} prompt but got ${prompt.type}`);
		}
		return prompt;
	}
}

function isCancelOptions(value: unknown): value is { cancel: true; timeout?: number | undefined } {
	return typeof value === "object" && value !== null && "cancel" in value;
}

export function createCliTestHarness(app: Application): CliTestHarness {
	return new CliTestHarness(app);
}

function renderCliOutputAsMarkdown(outputs: CliOutput[]): string {
	return outputs.map(renderOneOutput).join("\n\n");
}

function renderOneOutput(output: CliOutput): string {
	if ("h1" in output) return `# ${output.h1}`;
	if ("h2" in output) return `## ${output.h2}`;
	if ("paragraph" in output) return output.paragraph;
	if ("br" in output) return "";
	if ("dl" in output) {
		const lines = output.dl.items.map((item) => {
			if (Array.isArray(item)) return `${item[0]}: ${item[1]}`;
			if (typeof item === "string") return item;
			return `${item.label}: ${item.definition}`;
		});
		const body = lines.join("\n");
		if (output.dl.title) return `## ${output.dl.title}\n\n${body}`;
		return body;
	}
	if ("ul" in output) {
		const lines = output.ul.items.map((item) => {
			const label = typeof item === "string" ? item : item.label;
			return `- ${label}`;
		});
		const body = lines.join("\n");
		if (output.ul.title) return `## ${output.ul.title}\n\n${body}`;
		return body;
	}
	// ol
	const lines = output.ol.items.map((item, i) => {
		if (typeof item === "string") return `${i + 1}. ${item}`;
		const num = item.listNumber ?? i + 1;
		return `${num}. ${item.label}`;
	});
	const body = lines.join("\n");
	if (output.ol.title) return `## ${output.ol.title}\n\n${body}`;
	return body;
}
