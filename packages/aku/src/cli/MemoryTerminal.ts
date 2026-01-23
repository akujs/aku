import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { Terminal, TerminalDefinitionListItem } from "./contracts/Terminal.ts";

export type TerminalOutput =
	| { paragraph: string }
	| { title: string }
	| { subtitle: string }
	| { definitionList: TerminalDefinitionListItem[] }
	| { fatalError: { error: unknown; crashDump: boolean } };

export class MemoryTerminal extends BaseClass implements Terminal {
	#exitCode = 0;
	output: TerminalOutput[] = [];
	crashDump: object | null = null;

	get exitCode(): number {
		return this.#exitCode;
	}

	p(text: string): void {
		this.output.push({ paragraph: text });
	}

	title(text: string): void {
		this.output.push({ title: text });
	}

	subtitle(text: string): void {
		this.output.push({ subtitle: text });
	}

	dl(items: TerminalDefinitionListItem[]): void {
		this.output.push({ definitionList: items });
	}

	fatalError(error: unknown): void {
		this.#exitCode = 1;

		if (error instanceof CliExitError) {
			this.output.push({ fatalError: { error, crashDump: false } });
		} else {
			this.crashDump = { error };
			this.output.push({ fatalError: { error, crashDump: true } });
		}
	}
}
