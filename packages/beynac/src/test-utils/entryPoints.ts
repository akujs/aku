/**
 * Entry points for the beynac package.
 * Shared between tsdown build config and source validation tests.
 */
export const ENTRY_POINTS = {
	container: "src/entry/container.ts",
	contracts: "src/contracts.ts",
	database: "src/database/database-entry-point.ts",
	errors: "src/errors.ts",
	events: "src/events.ts",
	facades: "src/facades.ts",
	"helpers/async": "src/entry/helpers/async.ts",
	"helpers/hash": "src/entry/helpers/hash.ts",
	"helpers/headers": "src/helpers/headers.ts",
	"helpers/str": "src/entry/helpers/str.ts",
	"helpers/time": "src/helpers/time.ts",
	http: "src/entry/http.ts",
	index: "src/entry/index.ts",
	integrations: "src/entry/integrations.ts",
	"integrations/next": "src/entry/integrations/next.ts",
	storage: "src/entry/storage.ts",
	testing: "src/entry/testing.ts",
	view: "src/entry/view.ts",
	"view/jsx-dev-runtime": "src/entry/view/jsx-dev-runtime.ts",
	"view/jsx-runtime": "src/entry/view/jsx-runtime.ts",
};
