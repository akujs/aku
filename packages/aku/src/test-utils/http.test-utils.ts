import type { Mock } from "bun:test";
import { mock } from "bun:test";
import type { BaseController, ControllerContext, FunctionController } from "../http/Controller.ts";
import { type ControllerReturn } from "../http/Controller.ts";
import { BaseMiddleware, type ClassMiddleware } from "../http/Middleware.ts";
import { ResourceController } from "../http/ResourceController.ts";

export class MockController extends ResourceController {
	override handle: Mock<BaseController["handle"]>;

	constructor(response: Response | (() => Response) | null = null) {
		super();
		this.handle = mock(() => {
			if (typeof response === "function") return response();
			return response ?? new Response();
		});
	}

	get meta(): Record<string, unknown> {
		return this.#firstCall("meta").meta;
	}

	get params(): Record<string, string> {
		return this.#firstCall("params").params;
	}

	get url(): URL | undefined {
		return this.#firstCall("url").url;
	}

	get rawParams(): Record<string, string> {
		return this.#firstCall("rawParams").rawParams;
	}

	get allParams(): Record<string, string>[] {
		return this.handle.mock.calls.map((call) => call[0].params);
	}

	#firstCall(method: string) {
		const { calls } = this.handle.mock;
		if (calls.length !== 1) {
			throw new Error(
				`handle(ctx) was called ${calls.length} times, mockController.${method} can only be used if the handler is called exactly once`,
			);
		}
		return calls[0][0];
	}
}

export const mockController = (): FunctionController & {
	mock: MockController;
} => {
	const mock = new MockController();
	const controller = (ctx: ControllerContext): ControllerReturn => mock.handle(ctx);
	return Object.assign(controller, { mock });
};

export const controllerContext = (
	request: Request = new Request("https://example.com/"),
): ControllerContext => ({
	request,
	params: {},
	rawParams: {},
	url: new URL(request.url),
	meta: {},
});

interface MockMiddlewareFunction {
	(name: string): ClassMiddleware;
	log: string[];
	beforeAfterLog: string[];
	reset(): void;
}

/**
 * Create a mock middleware class for testing.
 *
 * The returned function creates middleware classes that log their name when executed.
 * Access the execution log via `mockMiddleware.log` or `mockMiddleware.beforeAfterLog`
 * and reset both via `mockMiddleware.reset()`.
 *
 * @example
 * const M1 = mockMiddleware("M1");
 * router.register(get("/test", controller, { middleware: M1 }));
 * await request("/test");
 * expect(mockMiddleware.log).toEqual(["M1"]);
 *
 * @example
 * // Access before/after logs
 * const M = mockMiddleware("M");
 * // beforeAfterLog contains: ["M:before", "M:after"]
 * // log contains: ["M"]
 */
export const mockMiddleware: MockMiddlewareFunction = Object.assign(
	(name: string) => {
		// Validate that the name is a valid JavaScript identifier
		if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
			throw new Error(`mockMiddleware name must be a valid JavaScript identifier, got: ${name}`);
		}

		// Create a function that returns a class with the dynamic name extending BaseMiddleware.
		// oxlint-disable-next-line no-implied-eval -- Function constructor needed for dynamic class names
		const createClass = new Function(
			"BaseMiddleware",
			`return class ${name} extends BaseMiddleware {}`,
		);

		// Call the function to get the class
		const ClassConstructor = createClass(BaseMiddleware);

		// Add the handle method to the prototype
		ClassConstructor.prototype.handle = async function (
			ctx: ControllerContext,
			next: (ctx: ControllerContext) => ControllerReturn,
		): Promise<ControllerReturn> {
			mockMiddleware.log.push(name);
			mockMiddleware.beforeAfterLog.push(`${name}:before`);
			const result = await next(ctx);
			mockMiddleware.beforeAfterLog.push(`${name}:after`);
			return result;
		};

		return ClassConstructor as ClassMiddleware;
	},
	{
		log: [] as string[],
		beforeAfterLog: [] as string[],
		reset() {
			this.log.length = 0;
			this.beforeAfterLog.length = 0;
		},
	},
);
