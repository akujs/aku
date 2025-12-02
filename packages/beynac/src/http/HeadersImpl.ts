import { inject } from "../container/inject.ts";
import { IntegrationContext } from "../integrations/IntegrationContext.ts";
import { BaseClass } from "../utils.ts";
import type { Headers } from "./contracts/Headers.ts";

export class HeadersImpl extends BaseClass implements Headers {
	#keys: string[] | undefined;

	constructor(private context: IntegrationContext = inject(IntegrationContext)) {
		super();
	}

	get size(): number {
		return this.#getKeys().length;
	}

	get(name: string): string | null {
		return this.context.getRequestHeader(name);
	}

	keys(): ReadonlyArray<string> {
		if (!this.#keys) {
			this.#keys = this.#getKeys();
		}
		return this.#keys;
	}

	entries(): ReadonlyArray<[string, string]> {
		const result: [string, string][] = [];
		for (const name of this.keys()) {
			const value = this.get(name);
			if (value !== null) {
				result.push([name, value]);
			}
		}
		return result;
	}

	get canModify(): boolean {
		return this.context.setCookie !== null;
	}

	set(name: string, _value: string): void {
		if (!this.canModify) {
			throw new Error(
				`Cannot set header "${name}" in context "${this.context.context}": headers are read-only`,
			);
		}
		// TODO: Implement setResponseHeader in RequestContext
		throw new Error("setResponseHeader not yet implemented in RequestContext");
	}

	#getKeys() {
		const names = this.context.getRequestHeaderNames();
		return Array.from(names).map((name) => name.toLowerCase());
	}
}
