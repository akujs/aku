import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { DefinitionListItem, TerminalUi } from "./TerminalUi.ts";

export type TerminalOutput =
	| { paragraph: string }
	| { title: string }
	| { subtitle: string }
	| { definitionList: DefinitionListItem[] }
	| { fatalError: { error: unknown; crashDump: boolean } };

export class BufferTerminalUi extends BaseClass implements TerminalUi {
	#exitCode = 0;
	output: TerminalOutput[] = [];
	crashDump: object | null = null;

	get exitCode(): number {
		return this.#exitCode;
	}

	paragraph(text: string): void {
		this.output.push({ paragraph: text });
	}

	title(text: string): void {
		this.output.push({ title: text });
	}

	subtitle(text: string): void {
		this.output.push({ subtitle: text });
	}

	definitionList(items: DefinitionListItem[]): void {
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
