import { BeynacEvent } from "../core/core-events.ts";
import type { ControllerContext } from "./Controller.ts";

/**
 * Event dispatched after a request has been successfully handled.
 */
export class RequestHandledEvent extends BeynacEvent {
	readonly #response: Response;
	#headers?: Headers;

	constructor(
		public readonly context: ControllerContext,
		response: Response,
	) {
		super();
		this.#response = response;
	}

	get status(): number {
		return this.#response.status;
	}

	get headers(): Headers | undefined {
		if (!this.#headers) {
			this.#headers = new Headers(this.#response.headers);
		}
		return this.#headers;
	}

	/**
	 * Get a clone of the response so that you can access the response body.
	 */
	cloneResponse(): Response {
		return this.#response.clone() as Response;
	}
}
