import { BaseClass } from "../utils.ts";
import { CliExitError } from "./cli-errors.ts";
import type {
	CliApi,
	CliConfirmOptions,
	CliDlOptions,
	CliInputOptions,
	CliOlOptions,
	CliPromptResponse,
	CliSelectOptions,
	CliUlOptions,
} from "./contracts/CliApi.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";

type CliOutput =
	| { paragraph: string }
	| { h1: string }
	| { h2: string }
	| { br: true }
	| { dl: CliDlOptions }
	| { ul: CliUlOptions }
	| { ol: CliOlOptions };

export type PendingPrompt =
	| {
			type: "select";
			options: CliSelectOptions<unknown>;
			respond(r: CliPromptResponse<unknown>): void;
	  }
	| {
			type: "input";
			options: CliInputOptions<unknown>;
			respond(r: CliPromptResponse<unknown>): void;
	  }
	| { type: "confirm"; options: CliConfirmOptions; respond(r: CliPromptResponse<unknown>): void };

export type CapturedError = {
	error: unknown;
	isExpected: boolean;
};

export class MemoryCliApi extends BaseClass implements CliApi, CliErrorHandler {
	columns = 80;
	isInteractive = false;
	outputs: CliOutput[] = [];
	errors: CapturedError[] = [];

	handleError(error: unknown, _cli: CliApi): number {
		this.errors.push({
			error,
			isExpected: error instanceof CliExitError,
		});
		return 1;
	}

	get lastError(): CapturedError | undefined {
		return this.errors[this.errors.length - 1];
	}

	#pendingPrompt: PendingPrompt | null = null;
	#promptNotifier: PromiseWithResolvers<void> | null = null;

	p(text: string): void {
		this.outputs.push({ paragraph: text });
	}

	br(): void {
		this.outputs.push({ br: true });
	}

	h1(text: string): void {
		this.outputs.push({ h1: text });
	}

	h2(text: string): void {
		this.outputs.push({ h2: text });
	}

	dl(options: CliDlOptions): void {
		this.outputs.push({ dl: options });
	}

	ul(options: CliUlOptions): void {
		this.outputs.push({ ul: options });
	}

	ol(options: CliOlOptions): void {
		this.outputs.push({ ol: options });
	}

	select<V>(options: CliSelectOptions<V>): Promise<CliPromptResponse<V>> {
		return this.#postPrompt("select", options) as Promise<CliPromptResponse<V>>;
	}

	input<T = string>(options: CliInputOptions<T>): Promise<CliPromptResponse<T>> {
		return this.#postPrompt("input", options as CliInputOptions<unknown>) as Promise<
			CliPromptResponse<T>
		>;
	}

	confirm(options: CliConfirmOptions): Promise<CliPromptResponse<boolean>> {
		return this.#postPrompt("confirm", options) as Promise<CliPromptResponse<boolean>>;
	}

	/**
	 * Wait for a prompt to be posted by a command calling select(), input(), or confirm().
	 *
	 * @param options.timeout Maximum time to wait in milliseconds (default 2000)
	 */
	async nextPrompt(options?: { timeout?: number | undefined }): Promise<PendingPrompt> {
		if (this.#pendingPrompt) {
			const prompt = this.#pendingPrompt;
			this.#pendingPrompt = null;
			return prompt;
		}

		const timeout = options?.timeout ?? 2000;
		this.#promptNotifier = Promise.withResolvers<void>();

		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				this.#promptNotifier.promise,
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error(`Timed out after ${timeout}ms waiting for a prompt`)),
						timeout,
					);
				}),
			]);
		} finally {
			clearTimeout(timer);
			this.#promptNotifier = null;
		}

		const prompt = this.#pendingPrompt!;
		this.#pendingPrompt = null;
		return prompt;
	}

	#postPrompt(
		type: PendingPrompt["type"],
		options: CliSelectOptions<unknown> | CliInputOptions<unknown> | CliConfirmOptions,
	): Promise<CliPromptResponse<unknown>> {
		const { promise, resolve } = Promise.withResolvers<CliPromptResponse<unknown>>();

		this.#pendingPrompt = {
			type,
			options,
			respond: resolve,
		} as PendingPrompt;

		if (this.#promptNotifier) {
			this.#promptNotifier.resolve();
		}

		return promise;
	}
}
