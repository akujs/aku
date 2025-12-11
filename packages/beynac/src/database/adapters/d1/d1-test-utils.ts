import type { D1Database as D1DatabaseBinding } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { D1DatabaseAdapter } from "./D1DatabaseAdapter.ts";
import { d1Database } from "./d1Database.ts";

let sharedMf: Miniflare | null = null;

async function getD1Binding(): Promise<D1DatabaseBinding> {
	if (!sharedMf) {
		sharedMf = new Miniflare({
			modules: true,
			script: `export default { fetch() { return new Response("ok"); } }`,
			d1Databases: {
				DB: "shared-test-db",
			},
		});
	}
	return await sharedMf.getD1Database("DB");
}

export const d1SharedTestConfig: SharedTestConfig = {
	name: D1DatabaseAdapter.name,
	createDatabase: async () => {
		const binding = await getD1Binding();
		return d1Database({ binding });
	},
	supportsTransactions: false,
};
