import { describe, expect, test } from "bun:test";
import { mockDispatcher } from "../../../test-utils/internal-mocks.test-utils.ts";
import type { DatabaseAdapter } from "../../DatabaseAdapter.ts";
import { DatabaseImpl } from "../../DatabaseImpl.ts";
import { D1DatabaseAdapter } from "./D1DatabaseAdapter.ts";

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
