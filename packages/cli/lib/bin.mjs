#!/usr/bin/env -S node --experimental-strip-types --disable-warning=ExperimentalWarning

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const SUPPORTED_CLI_API_VERSION = 1;

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
	const { runCli, CLI_API_VERSION } = await import(join(akuPath, "dist/cli.mjs"));

	const upgradeCommands = {
		npm: "npm install -g @akujs/cli@latest",
		yarn: "yarn global add @akujs/cli@latest",
		pnpm: "pnpm add -g @akujs/cli@latest",
		bun: "bun add -g @akujs/cli@latest",
	};

	if (CLI_API_VERSION !== undefined && CLI_API_VERSION > SUPPORTED_CLI_API_VERSION) {
		const pm = detectPackageManager();
		let upgradeAdvice;
		if (pm) {
			upgradeAdvice = "Run:\n\n  " + upgradeCommands[pm];
		} else {
			upgradeAdvice =
				"Use the appropriate command for the package manager you used to install @akujs/cli, e.g.\n\n" +
				Object.values(upgradeCommands).map((cmd) => "  " + cmd).join("\n");
		}
		console.error(
			"Error: Your global @akujs/cli is too old for the local @akujs/aku package.\n\n" +
				"Please upgrade to the latest version. " +
				upgradeAdvice +
				"\n",
		);
		process.exit(1);
	}

	runCli();
} catch (error) {
	console.error(
		"Error: Failed to load Aku CLI. Your installation may be corrupted.\n" +
			"Try reinstalling with: npm install @akujs/aku\n\n" +
			String(error),
	);
	process.exit(1);
}

function detectPackageManager() {
	try {
		// Bun runtime detection
		if (typeof globalThis.Bun !== "undefined") return "bun";

		// Resolve the aku binary path and check for PM-specific directories
		const binPath = execSync("which aku", { encoding: "utf8" }).trim();
		if (binPath.includes(".bun")) return "bun";
		if (binPath.includes("pnpm")) return "pnpm";
		if (binPath.includes("yarn")) return "yarn";
		if (binPath.includes(".nvm")) return "npm";
		// Path is ambiguous (e.g. /usr/local/bin/aku) - can't determine PM
		return undefined;
	} catch {
		return undefined;
	}
}
