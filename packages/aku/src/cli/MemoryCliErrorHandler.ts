import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import type { Terminal } from "./contracts/Terminal.ts";

export type CapturedError = {
	error: unknown;
	isExpected: boolean;
};

export class MemoryCliErrorHandler extends BaseClass implements CliErrorHandler {
	errors: CapturedError[] = [];

	handleError(error: unknown, _terminal: Terminal): number {
		this.errors.push({
			error,
			isExpected: error instanceof CliExitError,
		});
		return 1;
	}

	get lastError(): CapturedError | undefined {
		return this.errors[this.errors.length - 1];
	}

	clear(): void {
		this.errors.length = 0;
	}
}
