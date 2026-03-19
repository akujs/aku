/* eslint-disable no-restricted-globals -- Human approved: this file is the ProcessApi implementation that wraps the process global */
import { writeFileSync } from "node:fs";
import { isAbsolute } from "node:path";

type KeypressHandler = (char: string, key: { name: string }) => void;

export interface ProcessApi {
	argv(): string[];
	stdout(message: string): void;
	stderr(message: string): void;
	exit(code: number): void;
	cwd(): string;
	getEnv(name: string): string | undefined;
	stdoutColumns(): number;
	stdinIsTty(): boolean;
	version(): string;
	platform(): string;
	writeFile(path: string, content: string): boolean;
	onUnhandledError(handler: (error: unknown) => void): void;
	onKeypress(handler: KeypressHandler): void;
	offKeypress(handler: KeypressHandler): void;
	cleanup(): void;
	importModule(path: string): Promise<unknown>;
}

const errorCleanups: Array<() => void> = [];
const keypressHandlers: Set<KeypressHandler> = new Set();

export const realProcessApi: ProcessApi = {
	argv: () => process.argv.slice(2),
	stdout: (msg) => {
		process.stdout.write(msg);
	},
	stderr: (msg) => {
		process.stderr.write(msg);
	},
	exit: (code) => {
		process.exit(code);
	},
	cwd: () => process.cwd(),
	getEnv: (name) => process.env[name],
	stdoutColumns: () => process.stdout.columns || 80,
	stdinIsTty: () => !!process.stdin.isTTY,
	version: () => process.version,
	platform: () => process.platform,
	writeFile: (path, content) => {
		try {
			writeFileSync(path, content);
			return true;
		} catch {
			return false;
		}
	},
	onUnhandledError: (handler) => {
		const onException = (error: Error) => handler(error);
		const onRejection = (reason: unknown) => handler(reason);
		process.on("uncaughtException", onException);
		process.on("unhandledRejection", onRejection);
		errorCleanups.push(() => {
			process.removeListener("uncaughtException", onException);
			process.removeListener("unhandledRejection", onRejection);
		});
	},
	onKeypress: (handler) => {
		keypressHandlers.add(handler);
		process.stdin.on("keypress", handler);
	},
	offKeypress: (handler) => {
		keypressHandlers.delete(handler);
		process.stdin.removeListener("keypress", handler);
	},
	cleanup: () => {
		for (const fn of errorCleanups) fn();
		errorCleanups.length = 0;
		for (const handler of keypressHandlers) {
			process.stdin.removeListener("keypress", handler);
		}
		keypressHandlers.clear();
	},
	importModule: (path) => {
		if (!isAbsolute(path)) {
			throw new Error(`importModule requires an absolute path, got: ${path}`);
		}
		return import(path);
	},
};
