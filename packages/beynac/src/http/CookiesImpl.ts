import { inject } from "../container/inject.ts";
import { type CookieAttributes, IntegrationContext } from "../integrations/IntegrationContext.ts";
import { BaseClass } from "../utils.ts";
import type { Cookies } from "./contracts/Cookies.ts";

export class CookiesImpl extends BaseClass implements Cookies {
	#keys: string[] | undefined;
	#entries: [string, string][] | undefined;
	#requestContext: IntegrationContext;

	constructor(requestContext: IntegrationContext = inject(IntegrationContext)) {
		super();
		this.#requestContext = requestContext;
	}

	get size(): number {
		return this.#getKeys().length;
	}

	get(name: string): string | null {
		return this.#requestContext.getCookie(name);
	}

	keys(): ReadonlyArray<string> {
		if (!this.#keys) {
			this.#keys = this.#getKeys();
		}
		return this.#keys;
	}

	entries(): ReadonlyArray<readonly [string, string]> {
		if (!this.#entries) {
			this.#entries = this.#getKeys().map((name) => [name, this.get(name) ?? ""]);
		}
		return this.#entries;
	}

	get canModify(): boolean {
		return this.#requestContext.setCookie !== null;
	}

	delete(name: string): void {
		if (!this.canModify) {
			throw new Error(
				`Cannot delete cookie "${name}" in context "${this.#requestContext.context}": cookies are read-only`,
			);
		}
		const deleteCookie = this.#requestContext.deleteCookie;
		if (!deleteCookie) {
			throw new Error(
				`Cannot delete cookie "${name}" in context "${this.#requestContext.context}": deleteCookie is not available`,
			);
		}
		deleteCookie(name);
	}

	set(name: string, value: string, options?: CookieAttributes): void {
		if (!this.canModify) {
			throw new Error(
				`Cannot set cookie "${name}" in context "${this.#requestContext.context}": cookies are read-only`,
			);
		}
		const setCookie = this.#requestContext.setCookie;
		if (!setCookie) {
			throw new Error(
				`Cannot set cookie "${name}" in context "${this.#requestContext.context}": setCookie is not available`,
			);
		}
		setCookie(name, value, options);
	}

	#getKeys() {
		return Array.from(this.#requestContext.getCookieNames());
	}
}
