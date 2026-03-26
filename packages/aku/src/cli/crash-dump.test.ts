import { describe, expect, test } from "bun:test";
import { writeCrashDumpAndExit } from "./crash-dump.ts";
import { MemoryProcessApi } from "./MemoryProcessApi.ts";

describe(writeCrashDumpAndExit, () => {
	test("writes crash dump file to cwd", () => {
		const proc = new MemoryProcessApi();

		writeCrashDumpAndExit(new Error("boom"), proc);

		const files = proc.state.files;
		expect(files).toBeDefined();
		const filenames = Object.keys(files!);
		expect(filenames).toHaveLength(1);
		expect(filenames[0]).toMatch(/^\/test\/aku-crash-\d+\.log$/);
	});

	test("crash dump contains expected fields for Error", () => {
		const proc = new MemoryProcessApi();
		const error = new Error("test error");

		writeCrashDumpAndExit(error, proc);

		const content = Object.values(proc.state.files!)[0];
		const dump = JSON.parse(content);
		dump.timestamp = "<timestamp>";
		dump.error.stack = "<stack>";

		expect(dump).toMatchInlineSnapshot(`
{
  "cwd": "/test",
  "error": {
    "message": "test error",
    "name": "Error",
    "stack": "<stack>",
  },
  "nodeVersion": "v0.0.0-test",
  "platform": "test",
  "timestamp": "<timestamp>",
}
`);
	});

	test("crash dump contains string for non-Error values", () => {
		const proc = new MemoryProcessApi();

		writeCrashDumpAndExit("string error", proc);

		const content = Object.values(proc.state.files!)[0];
		const dump = JSON.parse(content);
		dump.timestamp = "<timestamp>";

		expect(dump).toMatchInlineSnapshot(`
{
  "cwd": "/test",
  "error": "string error",
  "nodeVersion": "v0.0.0-test",
  "platform": "test",
  "timestamp": "<timestamp>",
}
`);
	});

	test("reports file path to stderr", () => {
		const proc = new MemoryProcessApi();

		writeCrashDumpAndExit(new Error("boom"), proc);

		expect(proc.state.stderr).toBeDefined();
		const stderrJoined = proc.state.stderr!.join("");
		expect(stderrJoined).toContain("Crash dump saved to: /test/aku-crash-");
		expect(stderrJoined).toContain("https://github.com/akujs/aku/issues");
	});

	test("writes dump to stderr when file write fails", () => {
		const proc = new MemoryProcessApi({ writeFileFails: true });

		writeCrashDumpAndExit(new Error("boom"), proc);

		expect(proc.state.files).toBeUndefined();
		const stderrJoined = proc.state.stderr!.join("");
		expect(stderrJoined).toContain("Failed to write crash dump file");
		expect(stderrJoined).toContain("Crash dump:\n");
		expect(stderrJoined).toContain('"message": "boom"');
	});

	test("crash dump includes error cause chain", () => {
		const proc = new MemoryProcessApi();
		const rootCause = new Error("root cause");
		const midError = new Error("mid error", { cause: rootCause });
		const topError = new Error("top error", { cause: midError });

		writeCrashDumpAndExit(topError, proc);

		const content = Object.values(proc.state.files!)[0];
		const dump = JSON.parse(content);
		dump.timestamp = "<timestamp>";
		dump.error.stack = "<stack>";
		dump.error.cause.stack = "<stack>";
		dump.error.cause.cause.stack = "<stack>";

		expect(dump.error).toMatchInlineSnapshot(`
{
  "cause": {
    "cause": {
      "message": "root cause",
      "name": "Error",
      "stack": "<stack>",
    },
    "message": "mid error",
    "name": "Error",
    "stack": "<stack>",
  },
  "message": "top error",
  "name": "Error",
  "stack": "<stack>",
}
`);
	});

	test("crash dump handles non-Error cause values", () => {
		const proc = new MemoryProcessApi();
		const error = new Error("wrapped", { cause: "string cause" });

		writeCrashDumpAndExit(error, proc);

		const content = Object.values(proc.state.files!)[0];
		const dump = JSON.parse(content);
		dump.timestamp = "<timestamp>";
		dump.error.stack = "<stack>";

		expect(dump.error).toMatchInlineSnapshot(`
{
  "cause": "string cause",
  "message": "wrapped",
  "name": "Error",
  "stack": "<stack>",
}
`);
	});

	test("calls exit(1)", () => {
		const proc = new MemoryProcessApi();

		writeCrashDumpAndExit(new Error("boom"), proc);

		expect(proc.state.exit).toBe(1);
	});
});
