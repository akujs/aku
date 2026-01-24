import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { Terminal } from "./Terminal.ts";

/**
 * Handle errors that occur during CLI command execution.
 *
 * The default implementation displays user-friendly messages for expected
 * errors (CliExitError) and writes crash dumps for unexpected errors.
 * Applications can provide custom implementations to change this behaviour.
 */
export interface CliErrorHandler {
	/**
	 * Handle an error and return the exit code that should be used.
	 *
	 * @param terminal The terminal instance for displaying error messages
	 */
	handleError(error: unknown, terminal: Terminal): number;
}

export const CliErrorHandler: TypeToken<CliErrorHandler> = createTypeToken("CliErrorHandler");
