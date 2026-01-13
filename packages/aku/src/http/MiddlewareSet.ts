import type { Container } from "../container/contracts/Container.ts";
import { arrayWrapOptional, BaseClass } from "../utils.ts";
import { isClassMiddleware, type MiddlewareNext, type MiddlewareReference } from "./Middleware.ts";

export class MiddlewareSet extends BaseClass {
	#middleware: Set<MiddlewareReference>;
	#withoutMiddleware: Set<MiddlewareReference | "all">;
	#prioritySorted = false;

	private constructor(
		middleware: MiddlewareReference[],
		withoutMiddleware: (MiddlewareReference | "all")[],
	) {
		super();
		this.#middleware = new Set(middleware);
		this.#withoutMiddleware = new Set(withoutMiddleware);
	}

	static createIfRequired(
		middleware?: MiddlewareReference | MiddlewareReference[] | null,
		withoutMiddleware?: MiddlewareReference | MiddlewareReference[] | "all" | null,
	): MiddlewareSet | null {
		const mw = arrayWrapOptional(middleware);
		const without = arrayWrapOptional(withoutMiddleware);

		if (mw.length === 0 && without.length === 0) {
			return null;
		}

		return new MiddlewareSet(
			mw.filter((m) => !without.includes(m)),
			without,
		);
	}

	mergeWithGroup(
		groupMiddleware: MiddlewareReference[],
		groupWithout: (MiddlewareReference | "all")[],
	): void {
		if (this.#withoutMiddleware.has("all")) {
			return;
		}

		groupWithout.forEach((m) => this.#withoutMiddleware.add(m));

		// Rebuild Set with group middleware first
		this.#middleware = new Set([
			...groupMiddleware.filter((m) => !this.#withoutMiddleware.has(m)),
			...this.#middleware,
		]);
	}

	buildPipeline(container: Container, finalHandler: MiddlewareNext): MiddlewareNext {
		const middlewareInstances = Array.from(this.#middleware);

		let next: MiddlewareNext = finalHandler;

		for (let i = middlewareInstances.length - 1; i >= 0; i--) {
			const middlewareRef = middlewareInstances[i];
			const currentNext = next;

			if (isClassMiddleware(middlewareRef)) {
				// Class middleware - get from container
				const middleware = container.get(middlewareRef);
				next = (ctx) => middleware.handle(ctx, currentNext);
			} else {
				// Function middleware - call directly
				next = (ctx) => middlewareRef(ctx, currentNext);
			}
		}

		return next;
	}

	applyPriority(priorityList: MiddlewareReference[]): void {
		if (this.#prioritySorted) return; // Already sorted, skip
		this.#prioritySorted = true;

		const middlewareArray = Array.from(this.#middleware);
		const sortedArray = this.#sortByPriority(middlewareArray, priorityList);
		this.#middleware = new Set(sortedArray);
	}

	#sortByPriority(
		middleware: MiddlewareReference[],
		priorityList: MiddlewareReference[],
	): MiddlewareReference[] {
		const priorityMap = new Map(priorityList.map((ref, index) => [ref, index]));

		return middleware.slice().sort((a, b) => {
			const aIndex = priorityMap.get(a);
			const bIndex = priorityMap.get(b);

			if (aIndex !== undefined && bIndex !== undefined) {
				return aIndex - bIndex;
			}
			if (aIndex !== undefined) return -1;
			if (bIndex !== undefined) return 1;
			return 0;
		});
	}
}
