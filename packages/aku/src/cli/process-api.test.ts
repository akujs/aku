import { describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTestDirectory } from "../testing/test-directories.ts";
import { realProcessApi } from "./process-api.ts";

describe("realProcessApi", () => {
	test("argv returns process.argv without first two elements", () => {
		const original = process.argv;
		process.argv = ["node", "script.js", "cmd", "--flag"];
		try {
			expect(realProcessApi.argv()).toEqual(["cmd", "--flag"]);
		} finally {
			process.argv = original;
		}
	});

	test("stdout writes to process.stdout", () => {
		const spy = spyOn(process.stdout, "write").mockImplementation(() => true);
		realProcessApi.stdout("hello");
		expect(spy).toHaveBeenCalledWith("hello");
	});

	test("stderr writes to process.stderr", () => {
		const spy = spyOn(process.stderr, "write").mockImplementation(() => true);
		realProcessApi.stderr("error");
		expect(spy).toHaveBeenCalledWith("error");
	});

	test("exit calls process.exit", () => {
		const spy = spyOn(process, "exit").mockImplementation(() => undefined as never);
		realProcessApi.exit(42);
		expect(spy).toHaveBeenCalledWith(42);
	});

	test("cwd returns process.cwd()", () => {
		expect(realProcessApi.cwd()).toBe(process.cwd());
	});

	test("getEnv returns environment variable value", () => {
		process.env.AKU_TEST_VAR = "test-value";
		expect(realProcessApi.getEnv("AKU_TEST_VAR")).toBe("test-value");
		delete process.env.AKU_TEST_VAR;
	});

	test("getEnv returns undefined for unset variable", () => {
		delete process.env.AKU_TEST_NONEXISTENT;
		expect(realProcessApi.getEnv("AKU_TEST_NONEXISTENT")).toBeUndefined();
	});

	test("stdoutColumns returns process.stdout.columns", () => {
		const original = process.stdout.columns;
		Object.defineProperty(process.stdout, "columns", { value: 142, configurable: true });
		expect(realProcessApi.stdoutColumns()).toBe(142);
		Object.defineProperty(process.stdout, "columns", { value: original, configurable: true });
	});

	test("stdoutColumns falls back to 80 when stdout has no columns", () => {
		const original = process.stdout.columns;
		Object.defineProperty(process.stdout, "columns", { value: 0, configurable: true });
		expect(realProcessApi.stdoutColumns()).toBe(80);
		Object.defineProperty(process.stdout, "columns", { value: original, configurable: true });
	});

	test("stdinIsTty returns boolean", () => {
		expect(typeof realProcessApi.stdinIsTty()).toBe("boolean");
	});

	test("version returns process.version", () => {
		expect(realProcessApi.version()).toBe(process.version);
	});

	test("platform returns process.platform", () => {
		expect(realProcessApi.platform()).toBe(process.platform);
	});

	test("writeFile writes a file and returns true", () => {
		const dir = createTestDirectory();
		const path = `${dir}/test-write.txt`;
		const result = realProcessApi.writeFile(path, "content");
		expect(result).toBe(true);

		expect(readFileSync(path, "utf-8")).toBe("content");
	});

	test("writeFile returns false for unwritable path", () => {
		const result = realProcessApi.writeFile("/nonexistent-dir/sub/file.txt", "content");
		expect(result).toBe(false);
	});

	describe("onUnhandledError", () => {
		test("registers uncaughtException listener, cleanup removes it", () => {
			const before = process.listenerCount("uncaughtException");
			realProcessApi.onUnhandledError(() => {});
			expect(process.listenerCount("uncaughtException")).toBe(before + 1);
			realProcessApi.cleanup();
			expect(process.listenerCount("uncaughtException")).toBe(before);
		});

		test("registers unhandledRejection listener, cleanup removes it", () => {
			const before = process.listenerCount("unhandledRejection");
			realProcessApi.onUnhandledError(() => {});
			expect(process.listenerCount("unhandledRejection")).toBe(before + 1);
			realProcessApi.cleanup();
			expect(process.listenerCount("unhandledRejection")).toBe(before);
		});
	});

	describe("onKeypress and offKeypress", () => {
		test("onKeypress registers listener, offKeypress removes it", () => {
			const before = process.stdin.listenerCount("keypress");
			const handler = () => {};
			realProcessApi.onKeypress(handler);
			expect(process.stdin.listenerCount("keypress")).toBe(before + 1);
			realProcessApi.offKeypress(handler);
			expect(process.stdin.listenerCount("keypress")).toBe(before);
		});

		test("cleanup removes keypress listeners", () => {
			const before = process.stdin.listenerCount("keypress");
			realProcessApi.onKeypress(() => {});
			realProcessApi.onKeypress(() => {});
			expect(process.stdin.listenerCount("keypress")).toBe(before + 2);
			realProcessApi.cleanup();
			expect(process.stdin.listenerCount("keypress")).toBe(before);
		});
	});

	describe("importModule", () => {
		test("imports a module by absolute path", async () => {
			const absolutePath = resolve(import.meta.dirname, "cli-errors.ts");
			const mod = (await realProcessApi.importModule(absolutePath)) as {
				CliExitError: unknown;
			};
			expect(mod.CliExitError).toBeDefined();
		});

		test("throws for a relative path", () => {
			expect(() => realProcessApi.importModule("./cli-errors.ts")).toThrow(
				"importModule requires an absolute path",
			);
		});
	});
});
