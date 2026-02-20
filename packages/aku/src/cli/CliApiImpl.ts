import { BaseClass } from "../utils.ts";
import type {
	CliApi,
	CliConfirmOptions,
	CliDefinitionListItem,
	CliDlOptions,
	CliInputOptions,
	CliOlOptions,
	CliPromptResponse,
	CliSelectOptions,
	CliUlOptions,
} from "./contracts/CliApi.ts";

export class CliApiImpl extends BaseClass implements CliApi {
	p(text: string): void {
		process.stdout.write(text + "\n");
	}

	br(): void {
		throw new Error("Not implemented");
	}

	h1(text: string): void {
		// Bold: \x1b[1m ... \x1b[0m
		process.stdout.write(`\x1b[1m${text}\x1b[0m\n`);
	}

	h2(text: string): void {
		// Underline: \x1b[4m ... \x1b[0m
		process.stdout.write(`\x1b[4m${text}\x1b[0m\n`);
	}

	dl(options: CliDlOptions): void {
		const { items } = options;
		if (items.length === 0) return;

		const normalised = items.map(normaliseDefinitionListItem);
		const maxLabelWidth = Math.max(...normalised.map((item) => item.label.length));
		const indent = "  ";

		for (const item of normalised) {
			const paddedLabel = item.label.padEnd(maxLabelWidth);
			process.stdout.write(`${indent}${paddedLabel}  ${item.definition}\n`);
		}
	}

	ul(_options: CliUlOptions): void {
		throw new Error("Not implemented");
	}

	ol(_options: CliOlOptions): void {
		throw new Error("Not implemented");
	}

	select<V>(_options: CliSelectOptions<V>): Promise<CliPromptResponse<V>> {
		throw new Error("Not implemented");
	}

	input<T = string>(_options: CliInputOptions<T>): Promise<CliPromptResponse<T>> {
		throw new Error("Not implemented");
	}

	confirm(_options: CliConfirmOptions): Promise<CliPromptResponse<boolean>> {
		throw new Error("Not implemented");
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
