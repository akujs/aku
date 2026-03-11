import { describe, expect, spyOn, test } from "bun:test";
import { CliExitError } from "./cli-errors.ts";
import { DefaultCliErrorHandler } from "./DefaultCliErrorHandler.ts";
import { MemoryCliApi } from "./MemoryCliApi.ts";

describe(DefaultCliErrorHandler, () => {
	test("returns the exit code from CliExitError", () => {
		spyOn(process.stderr, "write").mockImplementation(() => true);
		const handler = new DefaultCliErrorHandler();
		const cli = new MemoryCliApi();

		expect(handler.handleError(new CliExitError("fail", 2), cli)).toBe(2);
		expect(handler.handleError(new CliExitError("fail", 42), cli)).toBe(42);
	});
});
