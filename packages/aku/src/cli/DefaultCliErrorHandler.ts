import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import { writeCrashDumpAndExit } from "./crash-dump.ts";
import { type ProcessApi, realProcessApi } from "./process-api.ts";

export class DefaultCliErrorHandler extends BaseClass implements CliErrorHandler {
	#proc: ProcessApi;

	constructor(proc: ProcessApi = realProcessApi) {
		super();
		this.#proc = proc;
	}

	handleError(error: unknown, _cli: CliApi): number {
		if (error instanceof CliExitError) {
			this.#proc.stderr(`Error: ${error.message}\n`);
			return error.exitCode;
		}
		writeCrashDumpAndExit(error, this.#proc);
		return 1;
	}
}
