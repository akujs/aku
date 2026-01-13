import { AkuError } from "../core/core-errors.ts";
import { BaseClass } from "../utils.ts";
import type { MiddlewareReference } from "./Middleware.ts";

export class MiddlewarePriorityBuilder extends BaseClass {
	#list: MiddlewareReference[];

	constructor(defaultList: MiddlewareReference[]) {
		super();
		this.#list = [...defaultList]; // Clone to avoid mutation
	}

	/**
	 * Add middleware to the end of the priority list
	 */
	append(...middleware: MiddlewareReference[]): this {
		this.#list.push(...middleware);
		return this;
	}

	/**
	 * Add middleware to the start of the priority list
	 */
	prepend(...middleware: MiddlewareReference[]): this {
		this.#list.unshift(...middleware);
		return this;
	}

	/**
	 * Add middleware before target. Throws if target not found.
	 *
	 * @param toAdd - The middleware to insert
	 * @param target - The middleware to insert before
	 */
	addBefore(toAdd: MiddlewareReference, target: MiddlewareReference): this {
		const index = this.#list.indexOf(target);
		if (index === -1) {
			throw new AkuError(
				`${this.addBefore.name}(${toAdd.name}, ${target.name}): ${target.name} not found in priority list`,
			);
		}
		this.#list.splice(index, 0, toAdd);
		return this;
	}

	/**
	 * Add middleware after target. Throws if target not found.
	 * @param toAdd - The middleware to insert
	 * @param target - The middleware to insert after
	 */
	addAfter(toAdd: MiddlewareReference, target: MiddlewareReference): this {
		const index = this.#list.indexOf(target);
		if (index === -1) {
			throw new AkuError(
				`${this.addAfter.name}(${toAdd.name}, ${target.name}): ${target.name} not found in priority list`,
			);
		}
		this.#list.splice(index + 1, 0, toAdd);
		return this;
	}

	/**
	 * Replace entire priority list with a new list
	 */
	replaceAll(list: MiddlewareReference[]): this {
		this.#list = [...list];
		return this;
	}

	/**
	 * Remove middleware from priority list
	 */
	remove(...middleware: MiddlewareReference[]): this {
		this.#list = this.#list.filter((m) => !middleware.includes(m));
		return this;
	}

	/**
	 * Get the final priority list
	 * @internal
	 */
	toArray(): MiddlewareReference[] {
		return [...this.#list];
	}
}
