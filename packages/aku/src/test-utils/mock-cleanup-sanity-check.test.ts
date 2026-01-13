import { describe, expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("mock cleanup sanity check", () => {
	test("ERROR: tests must be run from package root (use 'bun run test')", () => {
		// Added because The tests below fail when run from a different location
		// because bun test fails to find the bunfig.toml
		const cwd = process.cwd();
		const packageJsonPath = join(cwd, "package.json");

		expect(existsSync(packageJsonPath)).toBe(true);
	});
	const testObject = {
		method() {
			return "original";
		},
	};

	test("first test: creates a mock", () => {
		const spy = spyOn(testObject, "method");
		spy.mockReturnValue("mocked");

		expect(testObject.method()).toBe("mocked");
	});

	test("Mock objects should be cleaned up after each test IF THIS FAILS THERE IS A PROJECT CONFIGURATION ISSUE, FIX THAT DON'T JUST FIX THIS TEST FILE!", () => {
		expect(testObject.method()).toBe("original");
	});
});
