import { STATUS_CODES } from "node:http";
import { inject } from "../container/inject.ts";
import { ViewRenderer } from "../view/contracts/ViewRenderer.ts";
import { jsx } from "../view/jsx.ts";
import { AbortException, abort, abortExceptionKey } from "./abort.ts";
import type { ControllerContext } from "./Controller.ts";
import { RequestLocals } from "./contracts/RequestLocals.ts";
import { BaseMiddleware, type MiddlewareNext } from "./Middleware.ts";
import type { RouteDefinition, StatusPages } from "./router-types.ts";
import { CurrentRouteDefinition, type StatusPageComponent } from "./router-types.ts";

/**
 * Middleware that renders custom error pages for 4xx and 5xx responses.
 */
export class StatusPagesMiddleware extends BaseMiddleware {
	#currentRoute: RouteDefinition;
	#locals: RequestLocals;
	#viewRenderer: ViewRenderer;

	constructor(
		currentRoute: RouteDefinition = inject(CurrentRouteDefinition),
		locals: RequestLocals = inject(RequestLocals),
		viewRenderer: ViewRenderer = inject(ViewRenderer),
	) {
		super();
		this.#currentRoute = currentRoute;
		this.#locals = locals;
		this.#viewRenderer = viewRenderer;
	}

	async handle(ctx: ControllerContext, next: MiddlewareNext): Promise<Response> {
		let response: Response;
		let abortException: AbortException | undefined;

		try {
			response = await next(ctx);
		} catch (error) {
			if (error instanceof AbortException) {
				abortException = error;
				response = error.response;
			} else {
				// Convert unknown errors to 500 responses
				abort.internalServerError(
					"Internal Server Error",
					error instanceof Error
						? error
						: new Error(`Request terminated by throwing non-Error value: ${String(error)}`, {
								cause: error,
							}),
				);
			}
		}

		// Only handle error responses (4xx and 5xx)
		if (response.status >= 400 && response.status < 600) {
			const statusPages = this.#currentRoute.statusPages;
			if (statusPages) {
				const StatusPageComponent = matchStatusPage(statusPages, response.status);

				if (StatusPageComponent) {
					if (abortException) {
						this.#locals.delete(abortExceptionKey);
					}

					const statusText = STATUS_CODES[response.status];
					const element = jsx(StatusPageComponent, {
						status: response.status,
						statusText: statusText,
						error: abortException?.cause ?? abortException,
					});

					// Return rendered response with original status code (never streamed)
					return this.#viewRenderer.renderResponse(element, {
						status: response.status,
						streaming: false,
					});
				}
			}
		}

		return response;
	}
}

function matchStatusPage(statusPages: StatusPages, status: number): StatusPageComponent | null {
	if (statusPages[status]) {
		return statusPages[status];
	}

	if (status >= 400 && status < 500 && "4xx" in statusPages) {
		return statusPages["4xx"];
	}

	if (status >= 500 && status < 600 && "5xx" in statusPages) {
		return statusPages["5xx"];
	}

	return null;
}
