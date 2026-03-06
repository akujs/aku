import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import { writeCrashDumpAndExit } from "./crash-dump.ts";

export class DefaultCliErrorHandler extends BaseClass implements CliErrorHandler {
	handleError(error: unknown, _cli: CliApi): number {
		if (error instanceof CliExitError) {
			process.stderr.write(`Error: ${error.message}\n`);
			return error.exitCode;
		}
		writeCrashDumpAndExit(error);
	}
}
