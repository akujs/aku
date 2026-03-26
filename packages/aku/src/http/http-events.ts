import { AkuEvent } from "../core/core-events.ts";

/**
 * Event dispatched after a request has been successfully handled.
 */
export class HttpRequestHandledEvent extends AkuEvent {
	readonly #response: Response;
	#headers?: Headers;
	readonly request: Request;

	constructor(request: Request, response: Response) {
		super();
		this.request = request;
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
