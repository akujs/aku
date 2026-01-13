import type { D1Database as D1DatabaseBinding } from "@cloudflare/workers-types";

/***/
export interface D1DatabaseAdapterConfig {
	/** The D1 database binding from the Cloudflare Workers environment. */
	binding: D1DatabaseBinding;
}
