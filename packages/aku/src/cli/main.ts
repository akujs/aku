import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { ApplicationImpl } from "../core/ApplicationImpl.ts";
import { CliExitError } from "./cli-errors.ts";
import { TerminalImpl } from "./TerminalImpl.ts";

/**
 * Entry point for CLI execution. Called by @akujs/cli global package.
 * Reads argv from process, discovers the app, runs the command, exits with appropriate code.
 */
export async function runCli(): Promise<never> {
	const args = process.argv.slice(2);
	const cwd = process.cwd();
	const terminal = new TerminalImpl();

	try {
		const { appPath, remainingArgs } = extractAppOption(args);
		const entryFile = findAppFile(cwd, appPath);

		const module = await import(entryFile);
		if (!module.app) {
			throw new CliExitError(
				'Entry file must export "app": export const app = createApplication(...)',
			);
		}
		if (!(module.app instanceof ApplicationImpl)) {
			throw new CliExitError('Exported "app" is not an Application instance');
		}

		await module.app.handleCommand(remainingArgs, terminal);
	} catch (error) {
		terminal.fatalError(error);
	}

	process.exit(terminal.exitCode);
}

function findAppFile(cwd: string, appPath?: string): string {
	if (appPath) {
		const resolved = resolve(cwd, appPath);
		if (!existsSync(resolved)) {
			throw new CliExitError(`Specified app file not found: ${appPath}`);
		}
		return resolved;
	}

	const candidates = [
		join(cwd, "aku", "app.ts"),
		join(cwd, "src", "aku", "app.ts"),
		join(cwd, "src", "app.ts"),
	];

	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}

	throw new CliExitError(
		"Could not find app file. Expected one of:\n" +
			"  - aku/app.ts\n" +
			"  - src/aku/app.ts\n" +
			"  - src/app.ts\n" +
			"Or specify with --app=./path/to/app.ts",
	);
}

interface ExtractedAppOption {
	appPath?: string | undefined;
	remainingArgs: string[];
}

function extractAppOption(args: string[]): ExtractedAppOption {
	let appPath: string | undefined;
	const remainingArgs: string[] = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		// Handle --app=value format
		if (arg.startsWith("--app=")) {
			appPath = arg.slice(6);
			continue;
		}

		// Handle --app value format
		if (arg === "--app") {
			const nextArg = args[i + 1];
			if (nextArg && !nextArg.startsWith("-")) {
				appPath = nextArg;
				i++; // Skip the next argument
				continue;
			}
		}

		remainingArgs.push(arg);
	}

	return { appPath, remainingArgs };
}
