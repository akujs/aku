import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";

type CapturedError = {
	error: unknown;
	isExpected: boolean;
};

export class MemoryCliErrorHandler extends BaseClass implements CliErrorHandler {
	errors: CapturedError[] = [];

	handleError(error: unknown, _cli: CliApi): number {
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
