import { abort } from "./abort.ts";
import { BaseController, type ControllerContext, type ControllerReturn } from "./Controller.ts";

export type ApiResourceAction = "index" | "store" | "show" | "update" | "destroy";

export type ResourceAction = ApiResourceAction | "create" | "edit";

/**
 * Abstract base class for RESTful resource controllers.
 *
 * Provides default implementations for all seven standard resource actions:
 * "index", "create", "store", "show", "edit", "update" and "destroy". Default
 * implementations return a 404. Subclasses override only the methods they need.
 *
 * The handle() method automatically delegates to the appropriate action method
 * based on the action specified in ctx.meta.action.
 *
 * This is designed to work with the resource() and apiResource() route helpers.
 *
 * @example
 * class PhotoController extends ResourceController {
 *   index(ctx: ControllerContext) {
 *     return new Response('List photos');
 *   }
 *
 *   show(ctx: ControllerContext) {
 *     const { resourceId } = ctx.params;
 *     return new Response(`Show photo ${resourceId}`);
 *   }
 *
 *   // Define other methods here, or leave undefined to return 404
 * }
 *
 * // Register all resource routes at once
 * resource('/photos', PhotoController)
 */
export abstract class ResourceController extends BaseController {
	handle(ctx: ControllerContext): ControllerReturn {
		const action = ctx.meta.action as ResourceAction;
		if (!action) {
			throw new Error(
				`[ResourceController] meta.action not set, this probably means that you're using ResourceController outside of a resource(...) or apiResource(...) route`,
			);
		}
		return this[action](ctx);
	}

	index(): ControllerReturn {
		abort.notFound();
	}

	create(_ctx: ControllerContext): ControllerReturn {
		abort.notFound();
	}

	store(_ctx: ControllerContext): ControllerReturn {
		abort.notFound();
	}

	show(_ctx: ControllerContext): ControllerReturn {
		abort.notFound();
	}

	edit(_ctx: ControllerContext): ControllerReturn {
		abort.notFound();
	}

	update(_ctx: ControllerContext): ControllerReturn {
		abort.notFound();
	}

	destroy(_ctx: ControllerContext): ControllerReturn {
		abort.notFound();
	}
}
