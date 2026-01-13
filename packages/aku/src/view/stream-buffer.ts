import { BaseClass } from "../utils.ts";

type RedirectedContent = string | RedirectedContent[];
type RedirectSink = RedirectedContent[];

export class StreamBuffer extends BaseClass {
	private buffer: string = "";
	private pending: string[] = [];
	private resolver: ((value: { done: boolean; chunk?: string }) => void) | null = null;
	private completed = false;
	private errorValue: Error | null = null;

	private activeRedirect: RedirectSink | null = null;
	private parentRedirects: RedirectSink[] = [];
	private redirects: Map<symbol, RedirectSink> = new Map();
	private redirectsEmitted = new Set<symbol>();
	private deferOutput = false;
	private deferredChunks: RedirectSink = []; // Chunks to yield at end when hasStackOut is true
	private firstStackOutBuffer: RedirectSink | null = null; // Track the first Stack.Out buffer for immediate streaming

	add(content: string): void {
		this.buffer += content;
	}

	/**
	 * Send any accumulated content to the iterator.
	 */
	yield(): void {
		if (!this.buffer) return;

		const chunk = this.buffer;
		this.buffer = "";

		if (this.activeRedirect) {
			if (this.activeRedirect === this.firstStackOutBuffer) {
				// The first Stack.Out we encounter can have its chunks stream as they
				// become available
				this.#sendToResolver(chunk);
			} else {
				// Other Stack.Outs need to have their content buffered until the end of
				// the document
				this.activeRedirect.push(chunk);
			}
		} else if (this.deferOutput) {
			this.deferredChunks.push(chunk);
		} else {
			this.#sendToResolver(chunk);
		}
	}

	complete(): void {
		this.yield();

		const flattenAndSend = (item: RedirectedContent): void => {
			if (typeof item === "string") {
				this.#sendToResolver(item);
			} else {
				for (const subItem of item) {
					flattenAndSend(subItem);
				}
			}
		};

		for (const item of this.deferredChunks) {
			flattenAndSend(item);
		}

		this.#terminate();
	}

	error(err: Error): void {
		this.errorValue = err;
		this.#terminate();
	}

	/**
	 * Start redirecting output to a separate buffer.
	 */
	beginRedirect(stackSymbol: symbol): void {
		// Always yield to flush any pending content
		this.yield();

		// Push current redirect to parent stack if there is one
		if (this.activeRedirect) {
			this.parentRedirects.push(this.activeRedirect);
		}

		const buffer = getOrCreateRedirect(this.redirects, stackSymbol);

		this.activeRedirect = buffer;
	}

	/**
	 * Stop redirecting.
	 */
	endRedirect(): void {
		// Always yield to flush any content accumulated during redirect
		// If this was the first stack, yield() will have already streamed it
		this.yield();

		// Pop back to parent redirect or null
		this.activeRedirect = this.parentRedirects.pop() ?? null;
	}

	emitRedirectedContent(stackSymbol: symbol): void {
		if (this.redirectsEmitted.has(stackSymbol)) {
			throw new Error("Stack.Out can only be used once per render");
		}
		this.redirectsEmitted.add(stackSymbol);

		this.yield();

		// Get or create the stack buffer array for this symbol
		const stackBuffer = getOrCreateRedirect(this.redirects, stackSymbol);

		// Push the array reference to the appropriate destination
		if (this.activeRedirect) {
			this.activeRedirect.push(stackBuffer);
		} else {
			// First top-level Stack.Out enables deferred mode
			if (!this.deferOutput) {
				this.deferOutput = true;
				this.firstStackOutBuffer = stackBuffer;

				// Immediately flush any existing content in the first stack's buffer
				const flattenAndSend = (item: RedirectedContent): void => {
					if (typeof item === "string") {
						this.#sendToResolver(item);
					} else {
						for (const subItem of item) {
							flattenAndSend(subItem);
						}
					}
				};

				for (const item of stackBuffer) {
					flattenAndSend(item);
				}
				// Clear the buffer since we've sent it
				stackBuffer.length = 0;
			} else {
				// Subsequent Stack.Outs get buffered normally
				this.deferredChunks.push(stackBuffer);
			}
		}
	}

	async *stream(): AsyncGenerator<string> {
		while (true) {
			if (this.pending.length > 0) {
				const chunk = this.pending.shift();
				if (chunk) yield chunk;
			} else if (this.completed) {
				if (this.errorValue) {
					throw this.errorValue;
				}
				return;
			} else {
				if (this.resolver !== null) {
					throw new Error("StreamBuffer already has a consumer waiting");
				}
				const result = await new Promise<{ done: boolean; chunk?: string }>((resolve) => {
					this.resolver = resolve;
				});
				if (result.done) {
					if (this.errorValue) {
						throw this.errorValue;
					}
					return;
				}
				if (result.chunk) {
					yield result.chunk;
				}
			}
		}
	}

	#terminate() {
		this.completed = true;

		if (this.resolver) {
			this.resolver({ done: true });
			this.resolver = null;
		}
	}

	#sendToResolver(chunk: string): void {
		if (this.resolver) {
			this.resolver({ done: false, chunk });
			this.resolver = null;
		} else {
			this.pending.push(chunk);
		}
	}
}

const getOrCreateRedirect = <K, V>(map: Map<K, V[]>, key: K): V[] => {
	let value = map.get(key);
	if (!value) {
		value = [];
		map.set(key, value);
	}
	return value;
};
