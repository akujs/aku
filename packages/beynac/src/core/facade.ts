import type { KeyOrClass } from "../container/container-key.ts";
import type { Application } from "./contracts/Application.ts";

type UnknownRecord = Record<string | symbol, unknown>;

let _facadeApplication: Application | null = null;

export const setFacadeApplication = (facadeApplication: Application | null): void => {
	_facadeApplication = facadeApplication ?? null;
};

export const getFacadeApplication = (): Application => {
	if (!_facadeApplication) {
		throw new Error(
			"Global application instance is not available. Ensure createApplication() has been called.",
		);
	}
	return _facadeApplication;
};

export function createFacade<T extends object>(key: KeyOrClass<T>): T {
	let lifecycleChecked = false;

	const getInstance = (): UnknownRecord => {
		const application = getFacadeApplication();
		if (!lifecycleChecked) {
			const lifecycle = application.container.getLifecycle(key);
			if (lifecycle === "transient") {
				throw new Error(
					`Cannot create facade for transient binding ${String(key)}. Facades only support singleton and scoped bindings.`,
				);
			}
			lifecycleChecked = true;
		}

		return application.container.get(key) as UnknownRecord;
	};

	return new Proxy({} as object, {
		get: (_target, prop) => {
			const instance = getInstance();
			let value = instance[prop];
			if (typeof value === "function") {
				// must bind function to instance, otherwise #private fields won't work
				value = value.bind(instance);
			}
			return value;
		},
		set: (_target, prop, value) => {
			getInstance()[prop] = value;
			return true;
		},
		has: (_target, prop) => {
			return prop in getInstance();
		},
		ownKeys: (_target) => {
			return Object.keys(getInstance());
		},
		getOwnPropertyDescriptor: (_target, prop) => {
			return Object.getOwnPropertyDescriptor(getInstance(), prop);
		},
	}) as T;
}
