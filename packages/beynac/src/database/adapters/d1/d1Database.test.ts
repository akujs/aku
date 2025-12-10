import { describe, expect, test } from "bun:test";
import type { D1Database as D1DatabaseBinding } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { mockDispatcher } from "../../../test-utils/internal-mocks.bun.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { DatabaseImpl } from "../../DatabaseImpl.ts";
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

describe(D1DatabaseAdapter, () => {
	test("adapter reports supportsTransactions as false", () => {
		const adapter: DatabaseAdapter = new D1DatabaseAdapter({
			// This test doesn't need miniflare so don't waste time initialising it
			binding: null!,
		});
		expect(adapter.supportsTransactions).toBe(false);
	});

	test("DatabaseImpl reports lack of transaction support for D1", () => {
		const adapter = new D1DatabaseAdapter({
			binding: null!,
		});
		const db = new DatabaseImpl(adapter, mockDispatcher());
		expect(db.supportsTransactions).toBe(false);
		expect(() => db.transaction(async () => null)).toThrowErrorMatchingInlineSnapshot(
			`"This database adapter does not support interactive transactions. Use batch() instead."`,
		);
	});
});
