import { BaseClass } from "../utils.ts";
import type { ProcessApi } from "./process-api.ts";

type KeypressHandler = (char: string, key: { name: string }) => void;

interface MemoryProcessApiState {
	stdout?: string[] | undefined;
	stderr?: string[] | undefined;
	exit?: number | undefined;
	files?: Record<string, string> | undefined;
}

interface MemoryProcessApiOptions {
	argv?: string[] | undefined;
	cwd?: string | undefined;
	env?: Record<string, string> | undefined;
	stdoutColumns?: number | undefined;
	stdinIsTty?: boolean | undefined;
	version?: string | undefined;
	platform?: string | undefined;
	writeFileFails?: boolean | undefined;
	importModule?: ((path: string) => Promise<unknown>) | undefined;
}

export class MemoryProcessApi extends BaseClass implements ProcessApi {
	#argv: string[];
	#cwd: string;
	#env: Record<string, string>;
	#columns: number;
	#stdinIsTty: boolean;
	#version: string;
	#platform: string;
	#writeFileFails: boolean;
	#importModule: (path: string) => Promise<unknown>;
	#state: MemoryProcessApiState = {};
	#errorHandlers: Array<(error: unknown) => void> = [];
	#keypressHandlers: Set<KeypressHandler> = new Set();

	constructor(options?: MemoryProcessApiOptions) {
		super();
		this.#argv = options?.argv ?? [];
		this.#cwd = options?.cwd ?? "/test";
		this.#env = options?.env ?? {};
		this.#columns = options?.stdoutColumns ?? 80;
		this.#stdinIsTty = options?.stdinIsTty ?? false;
		this.#version = options?.version ?? "v0.0.0-test";
		this.#platform = options?.platform ?? "test";
		this.#writeFileFails = options?.writeFileFails ?? false;
		this.#importModule =
			options?.importModule ??
			(() => {
				throw new Error("No importModule mock was configured on MemoryProcessApi");
			});
	}

	get state(): MemoryProcessApiState {
		return this.#state;
	}

	argv(): string[] {
		return this.#argv;
	}

	stdout(message: string): void {
		(this.#state.stdout ??= []).push(message);
	}

	stderr(message: string): void {
		(this.#state.stderr ??= []).push(message);
	}

	exit(code: number): void {
		this.#state.exit = code;
	}

	cwd(): string {
		return this.#cwd;
	}

	getEnv(name: string): string | undefined {
		return this.#env[name];
	}

	stdoutColumns(): number {
		return this.#columns;
	}

	stdinIsTty(): boolean {
		return this.#stdinIsTty;
	}

	version(): string {
		return this.#version;
	}

	platform(): string {
		return this.#platform;
	}

	writeFile(path: string, content: string): boolean {
		if (this.#writeFileFails) {
			return false;
		}
		(this.#state.files ??= {})[path] = content;
		return true;
	}

	onUnhandledError(handler: (error: unknown) => void): void {
		this.#errorHandlers.push(handler);
	}

	onKeypress(handler: KeypressHandler): void {
		this.#keypressHandlers.add(handler);
	}

	offKeypress(handler: KeypressHandler): void {
		this.#keypressHandlers.delete(handler);
	}

	cleanup(): void {
		this.#errorHandlers.length = 0;
		this.#keypressHandlers.clear();
	}

	importModule(path: string): Promise<unknown> {
		return this.#importModule(path);
	}

	simulateUnhandledError(error: unknown): void {
		if (this.#errorHandlers.length === 0) {
			throw new Error("No error handler registered — was onUnhandledError called?");
		}
		for (const handler of this.#errorHandlers) {
			handler(error);
		}
	}

	simulateKeypress(char: string, key: { name: string }): void {
		for (const handler of this.#keypressHandlers) {
			handler(char, key);
		}
	}
}
