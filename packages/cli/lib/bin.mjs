#!/usr/bin/env -S node --experimental-strip-types --disable-warning=ExperimentalWarning

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

let akuPath = process.cwd();

while (true) {
	const candidate = join(akuPath, "node_modules", "@akujs", "aku");
	if (existsSync(candidate)) {
		akuPath = candidate;
		break;
	}

	const parent = dirname(akuPath);
	if (parent === akuPath) {
		console.error(
			"Error: Could not find a local Aku installation.\n\n" +
				"Make sure you're in an Aku project directory with @akujs/aku installed",
		);
		process.exit(1);
	}
	akuPath = parent;
}

try {
	const { runCli } = await import(join(akuPath, "dist/cli.mjs"));
	runCli();
} catch (error) {
	console.error(
		"Error: Failed to load Aku CLI. Your installation may be corrupted.\n" +
			"Try reinstalling with: npm install @akujs/aku\n\n" +
			String(error),
	);
	process.exit(1);
}
