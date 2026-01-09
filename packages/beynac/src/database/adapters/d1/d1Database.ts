import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { D1DatabaseAdapter } from "./D1DatabaseAdapter.ts";
import type { D1DatabaseAdapterConfig } from "./D1DatabaseAdapterConfig.ts";

/**
 * Create a D1 database adapter
 *
 * D1 is configured via wrangler.toml in your cloudflare project, so there is no
 * further configuration available other than passing the D1 binding
 *
 * @example
 * import { env } from "cloudflare:workers";
 * createApplication({
 *   database: d1Database({
 *     binding: env.MY_D1_DB // name of binding from wrangler.toml
 *   }),
 *   ...
 * });
 */
export function d1Database(config: D1DatabaseAdapterConfig): DatabaseAdapter {
	return new D1DatabaseAdapter(config);
}
