import { BaseClass, type NoArgConstructor } from "../utils.ts";
import type { ControllerContext } from "./Controller.ts";

/**
 * The type of the `next` function passed as the second argument to middleware handlers
 */
export type MiddlewareNext = (ctx: ControllerContext) => Response | Promise<Response>;

export type FunctionMiddleware = (
	ctx: ControllerContext,
	next: MiddlewareNext,
) => Response | Promise<Response>;

interface IClassMiddlewareInstance {
	handle(ctx: ControllerContext, next: MiddlewareNext): Response | Promise<Response>;
}

export type ClassMiddleware = NoArgConstructor<IClassMiddlewareInstance> & {
	isClassMiddleware: true;
};

/**
 * Base class for middleware that processes HTTP requests.
 * Middleware can modify requests, short-circuit responses, or pass through to the next handler.
 */
export abstract class BaseMiddleware extends BaseClass implements IClassMiddlewareInstance {
	static readonly isClassMiddleware = true;

	/**
	 * Handle an HTTP request and optionally pass it to the next handler.
	 *
	 * @param ctx - Controller context containing request and route parameters
	 * @param next - Function to call the next middleware or final handler
	 * @returns Response or Promise resolving to Response
	 */
	abstract handle(ctx: ControllerContext, next: MiddlewareNext): Response | Promise<Response>;
}

/**
 * A reference to a middleware class or function
 */
export type MiddlewareReference = FunctionMiddleware | ClassMiddleware;

export function isClassMiddleware(value: unknown): value is ClassMiddleware {
	return (
		typeof value === "function" && "isClassMiddleware" in value && value.isClassMiddleware === true
	);
}
