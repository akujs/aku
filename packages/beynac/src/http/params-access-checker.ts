import { BeynacError } from "../core/core-errors.ts";

export function throwOnMissingPropertyAccess<T extends Record<string, unknown>>(params: T): T {
	return new Proxy(params, {
		get(target, prop, receiver) {
			if (!(prop in target)) {
				throw new BeynacError(`Route parameter "${String(prop)}" does not exist`);
			}
			return Reflect.get(target, prop, receiver) as unknown;
		},
	});
}
