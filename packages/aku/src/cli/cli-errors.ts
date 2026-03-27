import { AkuError } from "../core/core-errors.ts";
import { stringFindSimilar } from "../helpers/str/similarity.ts";
import { writeCrashDumpAndExit } from "./crash-dump.ts";
import type { ProcessApi } from "./process-api.ts";

/**
 * Error thrown by CLI commands to indicate that the command should exit. This
 * causes the process to exit with a non-zero error code.
 *
 * Unlike other errors, throwing this is not treated as a bug and won't trigger
 * a crash report.
 */
export class CliExitError extends AkuError {
	readonly exitCode: number;

	constructor(message: string, exitCode = 1) {
		super(message);
		this.exitCode = exitCode;
	}
}

export function handleCliError(error: unknown, proc: ProcessApi): number {
	if (error instanceof CliExitError) {
		proc.stderr(`Error: ${error.message}\n`);
		return error.exitCode;
	}
	writeCrashDumpAndExit(error, proc);
	return 1;
}

export function throwNotFoundError(itemType: string, name: string, candidates: string[]): never {
	const similar = stringFindSimilar(name, candidates, {
		threshold: 3,
		maxResults: 6,
	});
	let message = `${itemType} "${name}" not found.`;
	if (similar.length > 0) {
		message += `\n\nDid you mean:\n${similar.map((s) => `  ${s}`).join("\n")}`;
	}
	message += `\n\nRun "aku list" to see available commands.`;
	throw new CliExitError(message);
}
