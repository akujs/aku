import { inject } from "../container/inject.ts";
import { Configuration } from "../core/contracts/Configuration.ts";
import type { ControllerContext } from "../http/Controller.ts";
import { BaseMiddleware, type MiddlewareNext } from "../http/Middleware.ts";

export class DevModeAutoRefreshMiddleware extends BaseMiddleware {
	#reloadListeners = new Set<(reload: boolean) => void>();
	#config: Configuration;

	constructor(config: Configuration = inject(Configuration)) {
		super();
		this.#config = config;
	}

	triggerReload(): void {
		for (const listener of this.#reloadListeners) {
			listener(true);
		}
		this.#reloadListeners.clear();
	}

	destroy(): void {
		this.#reloadListeners.clear();
	}

	async handle(ctx: ControllerContext, next: MiddlewareNext): Promise<Response> {
		const url = new URL(ctx.request.url);

		if (url.searchParams.has("__aku_dev_mode_refresh")) {
			return this.#handleSSERequest();
		}

		const response = await next(ctx);
		const contentType = response.headers.get("Content-Type");
		if (contentType?.includes("text/html")) {
			return this.#injectScript(response);
		}
		return response;
	}

	#handleSSERequest(): Response {
		const encoder = new TextEncoder();
		let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
		let sendReload: ((reload: boolean) => void) | null = null;

		const heartbeatMs = this.#config.devMode?.autoRefreshHeartbeatMs ?? 15000;
		const reloadListeners = this.#reloadListeners;

		const stream = new ReadableStream({
			start(controller) {
				const sendHeartbeat = () => {
					controller.enqueue(encoder.encode(":heartbeat\n\n"));
				};
				sendReload = () => {
					controller.enqueue(encoder.encode('data: {"reload": true}\n\n'));
				};
				sendHeartbeat();
				heartbeatInterval = setInterval(sendHeartbeat, heartbeatMs);

				reloadListeners.add(sendReload);
			},
			cancel() {
				if (heartbeatInterval) {
					clearInterval(heartbeatInterval);
				}
				if (sendReload) {
					reloadListeners.delete(sendReload);
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	}

	#injectScript(response: Response): Response {
		const script = this.generateScript();
		const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();

		const body = response.body as ReadableStream<Uint8Array> | null;
		const reader = body?.getReader();
		const writer = writable.getWriter();
		const encoder = new TextEncoder();
		const decoder = new TextDecoder();

		let injected = false;

		void (async () => {
			if (!reader) {
				await writer.close();
				return;
			}

			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (!value) continue;

					if (!injected) {
						let chunk = decoder.decode(value, { stream: true });

						const injectBefore = (tag: RegExp) => {
							if (injected) return;

							const match = chunk.match(tag);
							if (match?.index !== undefined) {
								injected = true;
								chunk = chunk.substring(0, match.index) + script + chunk.substring(match.index);
							}
						};

						injectBefore(/<\/body>/i);
						injectBefore(/<\/html>/i);

						await writer.write(encoder.encode(chunk));
					} else {
						await writer.write(value);
					}
				}

				if (!injected) {
					await writer.write(encoder.encode(script));
				}

				await writer.close();
			} catch (error) {
				await writer.abort(error);
			}
		})();

		return new Response(readable, {
			status: response.status,
			headers: response.headers,
		});
	}

	private generateScript(): string {
		return /*ts*/ `
<script>
(function() {
  const eventSource = new EventSource('?__aku_dev_mode_refresh');
  let firstConnection = true;

  eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.reload) {
      console.log('[Aku] Dev mode detected file changes, reloading...');
      eventSource.close();
      location.reload();
    }
  };

  eventSource.onopen = function() {
    if (firstConnection) {
      console.log('[Aku] Dev mode enabled, watching for changes');
      firstConnection = false;
    } else {
      console.log('[Aku] Dev mode connection re-established, watching for changes');
    }
  };

  eventSource.onerror = function() {
    console.log('[Aku] Dev mode connection lost, reconnecting...');
  };

})();
</script>`;
	}
}
