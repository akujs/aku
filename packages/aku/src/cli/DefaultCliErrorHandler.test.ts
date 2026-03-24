import { describe, expect, test } from "bun:test";
import { CliExitError } from "./cli-errors.ts";
import { DefaultCliErrorHandler } from "./DefaultCliErrorHandler.ts";
import { MemoryCliApi } from "./MemoryCliApi.ts";
import { MemoryProcessApi } from "./MemoryProcessApi.ts";

describe(DefaultCliErrorHandler, () => {
	test("returns the exit code from CliExitError", () => {
		const proc = new MemoryProcessApi();
		const handler = new DefaultCliErrorHandler(proc);
		const cli = new MemoryCliApi();

		expect(handler.handleError(new CliExitError("fail", 2), cli)).toBe(2);
		expect(handler.handleError(new CliExitError("fail", 42), cli)).toBe(42);
	});

	test("writes expected error message to stderr", () => {
		const proc = new MemoryProcessApi();
		const handler = new DefaultCliErrorHandler(proc);
		const cli = new MemoryCliApi();

		handler.handleError(new CliExitError("something went wrong", 1), cli);

		expect(proc.state).toEqual({ stderr: ["Error: something went wrong\n"] });
	});

	test("writes crash dump for unexpected errors", () => {
		const proc = new MemoryProcessApi();
		const handler = new DefaultCliErrorHandler(proc);
		const cli = new MemoryCliApi();

		handler.handleError(new Error("unexpected"), cli);

		expect(proc.state.files).toBeDefined();
		expect(proc.state.exit).toBe(1);
	});

	test("returns exit code 1 for unexpected errors", () => {
		const proc = new MemoryProcessApi();
		const handler = new DefaultCliErrorHandler(proc);
		const cli = new MemoryCliApi();

		const result = handler.handleError(new Error("unexpected"), cli);

		expect(result).toBe(1);
	});
});
