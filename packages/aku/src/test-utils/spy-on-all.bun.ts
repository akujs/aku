import { spyOn } from "bun:test";
import { getPrototypeChain } from "../utils.ts";

/**
 * Spy on all methods of an object or instance
 */
export function spyOnAll<T extends object>(obj: T): T {
	const props = new Set<string | symbol>();

	// Get own properties
	Object.getOwnPropertyNames(obj).forEach((prop) => props.add(prop));
	Object.getOwnPropertySymbols(obj).forEach((prop) => props.add(prop));

	// Get prototype properties (for class methods)
	for (const constructor of getPrototypeChain(obj)) {
		if (constructor === Object) break;
		const proto = constructor.prototype;
		Object.getOwnPropertyNames(proto).forEach((prop) => props.add(prop));
		Object.getOwnPropertySymbols(proto).forEach((prop) => props.add(prop));
	}

	// Spy on each method
	for (const prop of props) {
		if (prop === "constructor") continue;

		try {
			const value = (obj as Record<string | symbol, unknown>)[prop];
			if (typeof value === "function") {
				spyOn(obj, prop as never);
			}
		} catch {
			// Skip properties that can't be accessed or spied on
		}
	}

	return obj;
}
