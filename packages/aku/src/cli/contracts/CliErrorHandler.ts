import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { CliApi } from "./CliApi.ts";

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
	 * @param cli - The CLI API instance for displaying error messages
	 */
	handleError(error: unknown, cli: CliApi): number;
}

export const CliErrorHandler: TypeToken<CliErrorHandler> = createTypeToken("CliErrorHandler");
