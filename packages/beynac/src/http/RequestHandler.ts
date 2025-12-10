import { Container } from "../container/contracts/Container.ts";
import { inject } from "../container/inject.ts";
import { Configuration, resolveEnvironmentChoice } from "../core/contracts/Configuration.ts";
import { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { BaseClass } from "../utils.ts";
import { ViewRenderer } from "../view/contracts/ViewRenderer.ts";
import { isJsxElement, type JSX } from "../view/view-types.ts";
import { AbortException, abortExceptionKey } from "./abort.ts";
import type { BaseController } from "./Controller.ts";
import {
	type Controller,
	type ControllerContext,
	type ControllerReturn,
	isClassController,
} from "./Controller.ts";
import { RequestLocals } from "./contracts/RequestLocals.ts";
import { RequestHandledEvent } from "./http-events.ts";
import { throwOnMissingPropertyAccess } from "./params-access-checker.ts";
import {
	CurrentControllerContext,
	CurrentRouteDefinition,
	type RouteDefinition,
	type RouteWithParams,
} from "./router-types.ts";

export class RequestHandler extends BaseClass {
	#throwOnInvalidParam: boolean;
	#streamResponses: boolean;
	#container: Container;
	#viewRenderer: ViewRenderer;
	#dispatcher: Dispatcher;

	constructor(
		container: Container = inject(Container),
		viewRenderer: ViewRenderer = inject(ViewRenderer),
		dispatcher: Dispatcher = inject(Dispatcher),
		config: Configuration = inject(Configuration),
	) {
		super();
		this.#container = container;
		this.#viewRenderer = viewRenderer;
		this.#dispatcher = dispatcher;
		const isDevelopment = !!config.development;
		this.#throwOnInvalidParam = resolveEnvironmentChoice(
			config.throwOnInvalidParamAccess,
			"always",
			isDevelopment,
		);
		this.#streamResponses = resolveEnvironmentChoice(
			config.streamResponses,
			"always",
			isDevelopment,
		);
	}

	async handle(match: RouteWithParams): Promise<Response> {
		const locals = this.#container.get(RequestLocals);

		// Store the route definition as a scoped instance for middleware access
		this.#container.scopedInstance(CurrentRouteDefinition, match.route);

		try {
			const decodedParams: Record<string, string> = {};
			for (const [key, value] of Object.entries(match.params)) {
				try {
					decodedParams[key] = decodeURIComponent(value);
				} catch {
					// If decoding fails, use the original value
					decodedParams[key] = value;
				}
			}

			const ctx: ControllerContext = {
				request: match.request,
				params: this.#throwOnInvalidParam
					? throwOnMissingPropertyAccess(decodedParams)
					: decodedParams,
				rawParams: this.#throwOnInvalidParam
					? throwOnMissingPropertyAccess(match.params)
					: match.params,
				url: match.url,
				meta: match.route.meta || {},
			};
			this.#container.scopedInstance(CurrentControllerContext, ctx);

			const finalHandler = async (ctx: ControllerContext): Promise<Response> => {
				let result: ControllerReturn;
				if (isClassController(match.route.controller)) {
					const controller = this.#container.get(match.route.controller);
					result = controller.handle(ctx);
				} else {
					if (isNativeClassConstructor(match.route.controller)) {
						throw new Error(
							`${controllerDescription(match.route.controller)} for ${match.route.path} is a class but does not extend Controller. ` +
								`Class-based handlers must extend the Controller class.`,
						);
					}
					result = match.route.controller(ctx);
				}

				return this.#convertToResponse(match.route, await result);
			};

			const pipeline = match.route.middleware
				? match.route.middleware.buildPipeline(this.#container, finalHandler)
				: finalHandler;

			const response = await pipeline(ctx);

			this.#dispatcher.dispatchIfHasListeners(
				RequestHandledEvent,
				() => new RequestHandledEvent(ctx, response),
			);

			const abortException = locals.get(abortExceptionKey);
			if (abortException) {
				// TODO: Connect to logging mechanism when available
				// eslint-disable-next-line no-console
				console.error(
					"abort() was caught and ignored by user code. The abort response will be returned anyway, but unnecessary work has probably been done. Ensure that your code rethrows AbortException if caught.",
				);
				throw abortException;
			}

			return response;
		} catch (error) {
			if (error instanceof AbortException) {
				locals.delete(abortExceptionKey);
				return error.response;
			}
			throw error;
		}
	}

	async #convertToResponse(
		route: RouteDefinition,
		result: Response | JSX.Element | null,
	): Promise<Response> {
		result = await result;
		if (result instanceof Response) {
			return result;
		}

		if (result === null) {
			return new Response();
		}

		if (isJsxElement(result)) {
			return this.#viewRenderer.renderResponse(result, { streaming: this.#streamResponses });
		}

		const hasHandleMethod = typeof (result as BaseController)?.handle !== "function";
		if (hasHandleMethod) {
			throw new Error(
				`${controllerDescription(route.controller)} for ${route.path} returned an object with a 'handle' method. This can happen if you have a controller that does not extend the Controller class. Ensure that controller classes extend Controller`,
			);
		}

		throw new Error(
			`${controllerDescription(route.controller)} for ${route.path} returned an invalid value. Expected Response, JSX element, or null, ` +
				`but got: ${Object.prototype.toString.call(result)}`,
		);
	}
}

const controllerDescription = (controller: Controller) => {
	return "Controller" + (controller.name ? " " : "") + controller.name;
};

const isNativeClassConstructor = (value: unknown): boolean =>
	typeof value === "function" && Function.prototype.toString.call(value).startsWith("class ");
