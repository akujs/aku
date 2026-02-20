import { BaseClass } from "../utils.ts";
import type {
	CliApi,
	CliConfirmOptions,
	CliDlOptions,
	CliInputOptions,
	CliOlOptions,
	CliPromptResponse,
	CliSelectOptions,
	CliUlOptions,
} from "./contracts/CliApi.ts";

export type CliOutput =
	| { paragraph: string }
	| { h1: string }
	| { h2: string }
	| { br: true }
	| { dl: CliDlOptions }
	| { ul: CliUlOptions }
	| { ol: CliOlOptions };

export class MemoryCliApi extends BaseClass implements CliApi {
	output: CliOutput[] = [];

	p(text: string): void {
		this.output.push({ paragraph: text });
	}

	br(): void {
		this.output.push({ br: true });
	}

	h1(text: string): void {
		this.output.push({ h1: text });
	}

	h2(text: string): void {
		this.output.push({ h2: text });
	}

	dl(options: CliDlOptions): void {
		this.output.push({ dl: options });
	}

	ul(options: CliUlOptions): void {
		this.output.push({ ul: options });
	}

	ol(options: CliOlOptions): void {
		this.output.push({ ol: options });
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
