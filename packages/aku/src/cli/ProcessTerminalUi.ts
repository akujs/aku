import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { DefinitionListItem, TerminalUi } from "./TerminalUi.ts";

export class ProcessTerminalUi extends BaseClass implements TerminalUi {
	#exitCode = 0;

	get exitCode(): number {
		return this.#exitCode;
	}

	paragraph(text: string): void {
		process.stdout.write(text + "\n");
	}

	title(text: string): void {
		// Bold: \x1b[1m ... \x1b[0m
		process.stdout.write(`\x1b[1m${text}\x1b[0m\n`);
	}

	subtitle(text: string): void {
		// Underline: \x1b[4m ... \x1b[0m
		process.stdout.write(`\x1b[4m${text}\x1b[0m\n`);
	}

	definitionList(items: DefinitionListItem[]): void {
		if (items.length === 0) return;

		const maxLabelWidth = Math.max(...items.map((item) => item.label.length));
		const indent = "  ";

		for (const item of items) {
			const paddedLabel = item.label.padEnd(maxLabelWidth);
			process.stdout.write(`${indent}${paddedLabel}  ${item.definition}\n`);
		}
	}

	fatalError(error: unknown): void {
		this.#exitCode = 1;

		if (error instanceof CliExitError) {
			process.stderr.write(`Error: ${error.message}\n`);
		} else {
			const dumpPath = this.#writeCrashDump(error);
			process.stderr.write(`Unexpected error. Crash dump saved to: ${dumpPath}\n`);
			process.stderr.write("Please report this issue at: https://github.com/akujs/aku/issues\n");
		}
	}

	#writeCrashDump(error: unknown): string {
		const dump = {
			timestamp: new Date().toISOString(),
			error:
				error instanceof Error
					? { name: error.name, message: error.message, stack: error.stack }
					: String(error),
			nodeVersion: process.version,
			platform: process.platform,
			cwd: process.cwd(),
		};

		const filename = `aku-crash-${Date.now()}.log`;
		const filepath = join(process.cwd(), filename);
		writeFileSync(filepath, JSON.stringify(dump, null, 2));
		return filepath;
	}
}
