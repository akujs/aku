import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import type { Terminal } from "./contracts/Terminal.ts";

export class DefaultCliErrorHandler extends BaseClass implements CliErrorHandler {
	handleError(error: unknown, _terminal: Terminal): number {
		if (error instanceof CliExitError) {
			process.stderr.write(`Error: ${error.message}\n`);
		} else {
			const dumpPath = this.#writeCrashDump(error);
			process.stderr.write(`Unexpected error. Crash dump saved to: ${dumpPath}\n`);
			process.stderr.write("Please report this issue at: https://github.com/akujs/aku/issues\n");
		}
		return 1;
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
