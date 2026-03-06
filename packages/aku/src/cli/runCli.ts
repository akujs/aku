import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { ApplicationImpl } from "../core/ApplicationImpl.ts";
import { CliApiImpl } from "./CliApiImpl.ts";
import { CliExitError } from "./cli-errors.ts";
import { writeCrashDumpAndExit } from "./crash-dump.ts";

/**
 * Entry point for CLI execution
 */
export async function runCli(): Promise<never> {
	process.on("uncaughtException", (error) => writeCrashDumpAndExit(error));
	process.on("unhandledRejection", (reason) => writeCrashDumpAndExit(reason));

	const args = process.argv.slice(2);
	const cwd = process.cwd();
	const cli = new CliApiImpl();

	let exitCode: number;

	try {
		const { appPath, remainingArgs } = extractAppOption(args);
		const entryFile = findAppFile(cwd, appPath);

		let module;
		try {
			module = await import(entryFile);
		} catch (error) {
			process.stderr.write(
				`Error: Failed to load app file ${appPath ?? entryFile}:\n${String(error)}\n`,
			);
			process.exit(1);
		}

		if (!module.app) {
			throw new CliExitError(
				'Entry file must export "app": export const app = createApplication(...)',
			);
		}
		if (!(module.app instanceof ApplicationImpl)) {
			throw new CliExitError('Exported "app" is not an Application instance');
		}

		exitCode = await module.app.handleCommand(remainingArgs, cli);
	} catch (error) {
		if (error instanceof CliExitError) {
			process.stderr.write(`Error: ${error.message}\n`);
			exitCode = error.exitCode;
		} else {
			writeCrashDumpAndExit(error);
		}
	}

	process.exit(exitCode);
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
