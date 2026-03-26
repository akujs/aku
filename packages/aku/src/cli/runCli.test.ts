import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDirectory } from "../testing/test-directories.ts";
import { MemoryProcessApi } from "./MemoryProcessApi.ts";
import { runCli } from "./runCli.ts";

describe(runCli, () => {
	describe("unhandled errors", () => {
		test("writes crash dump when unhandled Error occurs", async () => {
			const dir = createTestDirectory();
			const appFile = join(dir, "aku", "app.ts");
			mkdirSync(join(dir, "aku"), { recursive: true });
			writeFileSync(appFile, "// placeholder");

			const proc = new MemoryProcessApi({
				cwd: dir,
				importModule: () => new Promise(() => {}), // never resolves
			});

			const cliPromise = runCli(proc);

			// Simulate an unhandled error while runCli is waiting on the import
			proc.simulateUnhandledError(new Error("boom"));

			// The runCli promise may not resolve (it's stuck on import), but the error handler fires synchronously
			expect(proc.state.exit).toBe(1);
			expect(proc.state.files).toBeDefined();
			const fileContent = Object.values(proc.state.files!)[0];
			expect(fileContent).toContain('"message": "boom"');

			// Clean up: resolve the hanging promise by letting the test end
			void cliPromise;
		});

		test("writes crash dump when unhandled non-Error occurs", async () => {
			const dir = createTestDirectory();
			const appFile = join(dir, "aku", "app.ts");
			mkdirSync(join(dir, "aku"), { recursive: true });
			writeFileSync(appFile, "// placeholder");

			const proc = new MemoryProcessApi({
				cwd: dir,
				importModule: () => new Promise(() => {}), // never resolves
			});

			const cliPromise = runCli(proc);

			proc.simulateUnhandledError("string rejection");

			expect(proc.state.exit).toBe(1);
			expect(proc.state.files).toBeDefined();
			const fileContent = Object.values(proc.state.files!)[0];
			expect(fileContent).toContain("string rejection");

			void cliPromise;
		});
	});

	describe("module loading", () => {
		test("exits with error when app file import fails", async () => {
			const dir = createTestDirectory();
			const appFile = join(dir, "aku", "app.ts");
			mkdirSync(join(dir, "aku"), { recursive: true });
			writeFileSync(appFile, "// exists so findAppFile succeeds");

			const proc = new MemoryProcessApi({
				cwd: dir,
				importModule: () => Promise.reject(new Error("syntax error")),
			});

			await runCli(proc);

			expect(proc.state.exit).toBe(1);
			const stderrJoined = proc.state.stderr!.join("");
			expect(stderrJoined).toContain("Failed to load app file");
			expect(stderrJoined).toContain("syntax error");
		});

		test("exits with error when module has no app export", async () => {
			const dir = createTestDirectory();
			const appFile = join(dir, "aku", "app.ts");
			mkdirSync(join(dir, "aku"), { recursive: true });
			writeFileSync(appFile, "// exists");

			const proc = new MemoryProcessApi({
				cwd: dir,
				importModule: () => Promise.resolve({}),
			});

			await runCli(proc);

			expect(proc.state.exit).toBe(1);
			const stderrJoined = proc.state.stderr!.join("");
			expect(stderrJoined).toContain('must export "app"');
		});

		test("exits with error when app is not an ApplicationImpl", async () => {
			const dir = createTestDirectory();
			const appFile = join(dir, "aku", "app.ts");
			mkdirSync(join(dir, "aku"), { recursive: true });
			writeFileSync(appFile, "// exists");

			const proc = new MemoryProcessApi({
				cwd: dir,
				importModule: () => Promise.resolve({ app: {} }),
			});

			await runCli(proc);

			expect(proc.state.exit).toBe(1);
			const stderrJoined = proc.state.stderr!.join("");
			expect(stderrJoined).toContain("not an Application instance");
		});
	});

	describe("app file resolution", () => {
		test("exits with error when no app file found", async () => {
			const dir = createTestDirectory();

			const proc = new MemoryProcessApi({
				cwd: dir,
				importModule: () => Promise.resolve({}),
			});

			await runCli(proc);

			expect(proc.state.exit).toBe(1);
			const stderrJoined = proc.state.stderr!.join("");
			expect(stderrJoined).toContain("Could not find app file");
			expect(stderrJoined).toContain("aku/app.ts");
		});

		test("exits with error when --app= has empty value", async () => {
			const proc = new MemoryProcessApi({
				argv: ["--app="],
				importModule: () => Promise.resolve({}),
			});

			await runCli(proc);

			expect(proc.state.exit).toBe(1);
			const stderrJoined = proc.state.stderr!.join("");
			expect(stderrJoined).toContain("'--app' requires a value");
		});
	});
});
