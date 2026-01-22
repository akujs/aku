import { AkuError } from "../core/core-errors.ts";

/**
 * Error thrown by CLI commands to indicate that the command should exit. This
 * causes the process to exit with a non-zero error code.
 *
 * Unlike other errors, throwing this is not treated as a bug and won't trigger
 * a crash report.
 */
export class CliExitError extends AkuError {
	constructor(message: string) {
		super(message);
	}
}
