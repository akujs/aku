import { describe, expect, test } from "bun:test";
import * as Index from "../entry/http.ts";
import * as Helpers from "./helpers.ts";

describe("http public API exports", () => {
	test("all helpers.ts exports are re-exported from index.ts NOTE ONLY ADD EXPORTS TO index.ts IF THEY SHOULD BECOME PART OF THE PUBLIC API OTHERWISE MOVE THEM TO A DIFFERENT FILE!", () => {
		const helpersExports = Object.keys(Helpers).sort();
		const indexExports = Object.keys(Index).sort();

		const missingExports = helpersExports.filter(
			(exportName) => !indexExports.includes(exportName),
		);

		expect(missingExports).toEqual([]);
	});
});
