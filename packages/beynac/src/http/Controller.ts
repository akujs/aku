import type { NoArgConstructor } from "../utils.ts";
import { BaseClass } from "../utils.ts";
import type { JSX } from "../view/view-types.ts";

export type FunctionController = (ctx: ControllerContext) => ControllerReturn;

interface IClassControllerInstance {
	handle(ctx: ControllerContext): ControllerReturn;
}

export type ClassController = NoArgConstructor<IClassControllerInstance> & {
	isClassController: true;
};

/***/
export type Controller = FunctionController | ClassController;

export function isClassController(value: unknown): value is ClassController {
	return (
		typeof value === "function" && "isClassController" in value && value.isClassController === true
	);
}

/**
 * The return type for controllers.
 *
 * - Response: A standard HTTP response
 * - JSX.Element: A JSX element to be rendered as HTML
 * - null: empty response
 * - Promise of any of the above
 */
export type ControllerReturn =
	| Response
	| JSX.Element
	| null
	| Promise<Response | JSX.Element | null>;

/**
 * Context passed to controller handlers.
 * Contains the HTTP request and route parameters.
 */
export interface ControllerContext {
	/**
	 * The incoming HTTP request
	 */
	request: Request;

	/**
	 * Parameters extracted from the route path. These are url-decoded, so
	 *
	 * - route: `get(/search/{...query})`
	 * - request: /search/my%20query%20%2F%20request
	 * - params: {query: "my query / request"}
	 */
	params: Record<string, string>;

	/**
	 * Parameters extracted from the route path. These are url-decoded, so
	 *
	 * - route: `get(/search/{...query})`
	 * - request: /search/my%20query%20%2F%20request
	 * - params: {query: "my%20query%20%2F%20request"}
	 */
	rawParams: Record<string, string>;

	url: URL;

	/**
	 * Metadata associated with the route. This can contain any additional
	 * data passed via the route definition's meta field.
	 */
	meta: Record<string, any>; // oxlint-disable-line no-explicit-any -- deliberate choice of public api
}

/**
 * Base class for controllers.
 */
export abstract class BaseController extends BaseClass implements IClassControllerInstance {
	static readonly isClassController = true;

	/**
	 * Handle an HTTP request and return a response.
	 *
	 * This method is called when a route matches.
	 */
	abstract handle(ctx: ControllerContext): ControllerReturn;
}
