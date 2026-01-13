#!/usr/bin/env bun
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Glob } from "bun";

const srcDir = join(import.meta.dir, "..", "src");
const cwd = join(import.meta.dir, "..");

/**
 * Configuration for parallel test execution.
 * - `true`: run the entire folder as one parallel process
 * - `string[]`: run each pattern as a separate process, plus a fallback for unmatched tests
 */
const parallelConfig: Record<string, string[] | true> = {
	database: ["PGLiteDatabase", "D1Database", "PostgresDatabase"],
	storage: true,
};

async function runBunTests(args: string[]): Promise<boolean> {
	const fullArgs = ["bun", "--conditions=source", "test", "--only-failures", ...args];
	return runCommand(fullArgs);
}

const nodeTestArgs = [
	"node",
	"--disable-warning=ExperimentalWarning",
	"--experimental-strip-types",
	"--experimental-sqlite",
	"--test",
	"src/**/*.node-test.ts",
];

async function runNodeTests(): Promise<boolean> {
	return runCommand(nodeTestArgs);
}

function runNodeTestsSync(): number {
	const name = nodeTestArgs.join(" ");
	console.log("$", name);
	const proc = Bun.spawnSync(nodeTestArgs, {
		cwd,
		stdout: "inherit",
		stderr: "inherit",
	});
	return proc.exitCode;
}

async function runCommand(fullArgs: string[]): Promise<boolean> {
	const startTime = performance.now();
	const proc = Bun.spawn(fullArgs, {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);

	const ok = exitCode === 0;
	const elapsed = Math.round(performance.now() - startTime);

	const argsString = fullArgs.join(" ");
	if (ok) {
		console.log(`✔ ${argsString} (${elapsed}ms)`);
	} else {
		console.log(`✘ ${argsString}`);
		if (stdout) console.log(stdout);
		if (stderr) console.error(stderr);
	}

	return ok;
}

function buildExcludePattern(patterns: string[]): string {
	return `^(?!.*(${patterns.join("|")}))`;
}

async function main() {
	const args = process.argv.slice(2);
	const nodeOnly = args.includes("--node");

	if (nodeOnly) {
		process.exit(runNodeTestsSync());
	}

	if (args.length > 0) {
		// Any arguments trigger serial mode, passing args directly to bun test
		// allow --serial as an arg to trigger serial mode
		const passArgs = args.filter((a) => a !== "--serial");
		const bunArgs = ["bun", "--conditions=source", "test", ...passArgs];
		console.log("$", bunArgs.join(" "));
		const bunProc = Bun.spawnSync(bunArgs, {
			cwd,
			stdout: "inherit",
			stderr: "inherit",
		});

		// Run node tests after bun tests
		let exitCode = bunProc.exitCode;
		if (passArgs.length === 0) {
			exitCode ||= runNodeTestsSync();
		}

		process.exit(exitCode);
	}

	const startTime = performance.now();

	// Validate config keys match real folders
	const entries = await readdir(srcDir, { withFileTypes: true });
	const folders = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));

	for (const folder of Object.keys(parallelConfig)) {
		if (!folders.has(folder)) {
			throw new Error(`parallelConfig references non-existent folder: ${folder}`);
		}
	}

	// Glob all test files
	const glob = new Glob("**/*.test.{ts,tsx}");
	const allTestFiles: string[] = [];
	for await (const file of glob.scan(srcDir)) {
		allTestFiles.push(file);
	}

	// Track which folders are handled by config
	const configuredFolders = new Set(Object.keys(parallelConfig));

	// Build list of test processes
	const testPromises: Promise<boolean>[] = [];

	// Process configured folders
	for (const [folder, config] of Object.entries(parallelConfig)) {
		if (config === true) {
			// Run entire folder as one process
			testPromises.push(runBunTests([`src/${folder}`]));
		} else {
			// Run each pattern as separate process
			for (const pattern of config) {
				testPromises.push(runBunTests([`src/${folder}`, "-t", pattern]));
			}
			// Add fallback for unmatched tests in this folder
			const excludePattern = buildExcludePattern(config);
			testPromises.push(runBunTests([`src/${folder}`, "-t", excludePattern]));
		}
	}

	// Run all node tests as a single parallel worker
	testPromises.push(runNodeTests());

	// Collect remaining folders and root test files not in configured folders
	const remainingFolders = new Set<string>();
	const rootTestFiles: string[] = [];

	for (const file of allTestFiles) {
		const parts = file.split("/");
		if (parts.length === 1) {
			// Root-level test file
			rootTestFiles.push(`src/${file}`);
		} else {
			const topFolder = parts[0];
			if (!configuredFolders.has(topFolder)) {
				remainingFolders.add(topFolder);
			}
		}
	}

	const remainingPaths: string[] = [...rootTestFiles];
	for (const folder of remainingFolders) {
		remainingPaths.push(`src/${folder}`);
	}

	if (remainingPaths.length > 0) {
		testPromises.push(runBunTests(remainingPaths));
	}

	// Wait for all tests to complete
	const results = await Promise.all(testPromises);

	// Print results sequentially
	let hasFailures = results.some((result) => !result);

	const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
	console.log(hasFailures ? "💥  Tests failed" : "✅  All tests passed");
	console.log(`Total time: ${elapsed}s`);

	if (hasFailures) {
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Error running tests:", error);
	process.exit(1);
});
