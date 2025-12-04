import { describe, expect, test } from "bun:test";
import type { D1Database as D1DatabaseBinding } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import type { SharedTestConfig } from "../../database-test-utils.ts";
import { D1Database, d1Database } from "./D1Database.ts";

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
	name: D1Database.name,
	createDatabase: async () => {
		const binding = await getD1Binding();
		return d1Database({ binding });
	},
	supportsTransactions: false,
};

describe(D1Database, () => {
	test("advertises lack of transaction support", async () => {
		const database = new D1Database({
			// This test doesn't need miniflare so don't waste time initialising it
			binding: null!,
		});
		expect(database.supportsTransactions).toBe(false);
		expect(database.transaction(async () => null)).rejects.toThrowErrorMatchingInlineSnapshot(
			`"D1 does not support interactive transactions. Use batch() for atomic operations."`,
		);
	});
});
