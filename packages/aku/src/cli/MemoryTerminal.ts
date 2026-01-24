import { BaseClass } from "../utils.ts";
import type {
	Terminal,
	TerminalConfirmOptions,
	TerminalDlOptions,
	TerminalInputOptions,
	TerminalOlOptions,
	TerminalPromptResponse,
	TerminalSelectOptions,
	TerminalUlOptions,
} from "./contracts/Terminal.ts";

export type TerminalOutput =
	| { paragraph: string }
	| { h1: string }
	| { h2: string }
	| { br: true }
	| { dl: TerminalDlOptions }
	| { ul: TerminalUlOptions }
	| { ol: TerminalOlOptions };

export class MemoryTerminal extends BaseClass implements Terminal {
	output: TerminalOutput[] = [];

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

	dl(options: TerminalDlOptions): void {
		this.output.push({ dl: options });
	}

	ul(options: TerminalUlOptions): void {
		this.output.push({ ul: options });
	}

	ol(options: TerminalOlOptions): void {
		this.output.push({ ol: options });
	}

	select<V>(_options: TerminalSelectOptions<V>): Promise<TerminalPromptResponse<V>> {
		throw new Error("Not implemented");
	}

	input<T = string>(_options: TerminalInputOptions<T>): Promise<TerminalPromptResponse<T>> {
		throw new Error("Not implemented");
	}

	confirm(_options: TerminalConfirmOptions): Promise<TerminalPromptResponse<boolean>> {
		throw new Error("Not implemented");
	}
}
