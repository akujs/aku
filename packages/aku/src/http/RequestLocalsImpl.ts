import type { Key } from "../core/Key.ts";
import { BaseClass } from "../utils.ts";
import type { RequestLocals } from "./contracts/RequestLocals.ts";

export class RequestLocalsImpl extends BaseClass implements RequestLocals {
	#storage = new Map<Key, unknown>();

	get<T>(key: Key<T>): T {
		if (this.#storage.has(key)) {
			return this.#storage.get(key) as T;
		}
		return key.default as T;
	}

	set<T>(key: Key<T>, value: T): void {
		this.#storage.set(key, value);
	}

	has(key: Key): boolean {
		return this.#storage.has(key);
	}

	delete(key: Key): void {
		this.#storage.delete(key);
	}
}
