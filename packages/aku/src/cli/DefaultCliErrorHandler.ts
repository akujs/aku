import { BaseClass } from "../utils.ts";
import { handleCliError } from "./cli-errors.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import { type ProcessApi, realProcessApi } from "./process-api.ts";

export class DefaultCliErrorHandler extends BaseClass implements CliErrorHandler {
	#proc: ProcessApi;

	constructor(proc: ProcessApi = realProcessApi) {
		super();
		this.#proc = proc;
	}

	handleError(error: unknown, _cli: CliApi): number {
		return handleCliError(error, this.#proc);
	}
}
