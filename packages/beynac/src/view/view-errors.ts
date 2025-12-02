import { BeynacError } from "../core/core-errors.ts";

export type ErrorKind =
	| "content-function-error"
	| "content-function-promise-rejection"
	| "content-promise-error"
	| "attribute-type-error"
	| "invalid-content";

/**
 * Error thrown during rendering when an error occurs during content expansion or rendering.
 * Includes a component stack trace for debugging.
 */
export class RenderingError extends BeynacError {
	readonly errorKind: ErrorKind;
	readonly componentStack: string[];

	constructor(errorKind: ErrorKind, componentStack: string[], cause: unknown) {
		const errorDetail = cause instanceof Error ? cause.message : String(cause);

		// Build stack trace string
		const stackTrace = componentStack.map((name) => `<${name}>`).join(" -> ");
		const message = stackTrace
			? `Rendering error: ${errorDetail}; Component stack: ${stackTrace}`
			: `Rendering error: ${errorDetail}`;

		super(message);
		this.errorKind = errorKind;
		this.componentStack = componentStack;
		this.cause = cause;
	}
}
