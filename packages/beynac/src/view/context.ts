import { type Key } from "../core/Key.ts";
import { BaseClass } from "../utils.ts";
import type { Context } from "./view-types.ts";

export class ContextImpl extends BaseClass implements Context {
	private localValues: Map<Key, unknown> = new Map();
	private parent: ContextImpl | null;
	private modified = false;

	constructor(parent?: ContextImpl) {
		super();
		this.parent = parent ?? null;
	}

	get<T>(key: Key<T>): Exclude<T, undefined> | null {
		if (this.localValues.has(key)) {
			const result = this.localValues.get(key);
			return result as Exclude<T, undefined>;
		}
		if (this.parent) {
			return this.parent.get(key);
		}
		return (key.default ?? null) as Exclude<T, undefined> | null;
	}

	set<T>(key: Key<T>, value: T): void {
		this.localValues.set(key, value);
		this.modified = true;
	}

	fork(): ContextImpl {
		return new ContextImpl(this);
	}

	wasModified(): boolean {
		return this.modified;
	}
}
