import { ContainerImpl } from "../container/ContainerImpl.ts";
import type { Key } from "../core/Key.ts";
import { createKey } from "../core/Key.ts";
import { BaseClass } from "../utils.ts";
import { RequestLocals } from "./contracts/RequestLocals.ts";
import type { RedirectOptions } from "./redirect.ts";
import { redirectStatus } from "./redirect.ts";

/**
 * Exception thrown to abort request handling and return an HTTP response.
 * Caught by the router and the wrapped response is returned.
 *
 * This is not an error - it's used for control flow to exit early from
 * request handlers and return a specific response.
 */
export class AbortException extends BaseClass implements Error {
	readonly cause?: Error | undefined;
	readonly response: Response;
	readonly message: string;
	readonly name: string;

	constructor(response: Response, cause?: Error) {
		super();
		this.response = response;
		this.cause = cause;
		this.message = cause?.message ?? "Request aborted";
		this.name = this.constructor.name;
	}

	/**
	 * Create an AbortException with the given status code, body, and headers.
	 *
	 * @param status - HTTP status code
	 * @param body - Response body (optional)
	 * @param headers - Response headers (optional)
	 * @param cause - Original error that caused this abort (optional)
	 * @returns An AbortException wrapping a Response with the given parameters
	 */
	static forStatus(
		status: number,
		body: string | null = null,
		headers: Headers | Record<string, string> = {},
		cause?: Error,
	): AbortException {
		return new AbortException(new Response(body, { status, headers }), cause);
	}
}

/***/
export const abortExceptionKey: Key<AbortException | undefined> = createKey<AbortException>({
	displayName: "abortException",
});

export type Abort = {
	/**
	 * Abort request handling return a response with the given status code.
	 *
	 * @param status - HTTP status code
	 * @param message - Response message/body (optional)
	 * @param headers - Response headers (optional)
	 *
	 * @example
	 * abort(404);
	 *
	 * @example
	 * abort(403, 'Access denied');
	 *
	 * @example
	 * abort(301, '', { Location: '/new-url' });
	 */
	(status: number, message?: string, headers?: Headers | Record<string, string>): never;

	/**
	 * Abort the current request and redirect to the given URL.
	 *
	 * @param to - The URL to redirect to
	 * @param options.permanent - If true, Make a permanent redirect that instructs search engines to update their index to the new URL (default: false)
	 * @param options.preserveHttpMethod - If true, preserves HTTP method so POST requests will result in a POST request to the new URL (default: false)
	 *
	 * Status codes used:
	 * - 303 Temporary redirect, changes to GET method
	 * - 307 Temporary redirect, preserves method
	 * - 301 Permanent redirect, changes to GET
	 * - 308 Permanent redirect, preserves method
	 *
	 * @example
	 * abort.redirect('/login');
	 *
	 * @example
	 * abort.redirect('/new-location', { permanent: true });
	 */
	redirect(to: string, options?: RedirectOptions): never;

	/**
	 * Abort the current request and return a 404 Not Found response.
	 *
	 * @param message - Optional response message (default: "Not Found")
	 *
	 * @example
	 * const user = await findUser(id);
	 * if (!user) abort.notFound();
	 *
	 * @example
	 * abort.notFound('User not found');
	 */
	notFound(message?: string): never;

	/**
	 * Abort the current request and return a 400 Bad Request response.
	 *
	 * @param message - Optional response message (default: "Bad Request")
	 *
	 * @example
	 * abort.badRequest('Invalid input format');
	 */
	badRequest(message?: string): never;

	/**
	 * Abort the current request and return a 401 Unauthorized response.
	 *
	 * Use when authentication is required but not provided.
	 *
	 * @param message - Optional response message (default: "Unauthorized")
	 *
	 * @example
	 * if (!req.headers.authorization) abort.unauthorized();
	 */
	unauthorized(message?: string): never;

	/**
	 * Abort the current request and return a 403 Forbidden response.
	 *
	 * Use when user is authenticated but lacks permission.
	 *
	 * @param message - Optional response message (default: "Forbidden")
	 *
	 * @example
	 * if (!user.isAdmin) abort.forbidden();
	 */
	forbidden(message?: string): never;

	/**
	 * Abort the current request and return a 405 Method Not Allowed response.
	 *
	 * @param message - Optional response message (default: "Method Not Allowed")
	 */
	methodNotAllowed(message?: string): never;

	/**
	 * Abort the current request and return a 410 Gone response.
	 *
	 * Use when a resource has been permanently removed.
	 *
	 * @param message - Optional response message (default: "Gone")
	 *
	 * @example
	 * if (post.deletedAt) abort.gone('This post has been deleted');
	 */
	gone(message?: string): never;

	/**
	 * Abort the current request and return a 422 Unprocessable Entity response.
	 *
	 * Typically used for validation errors.
	 *
	 * @param message - Optional response message (default: "Unprocessable Entity")
	 *
	 * @example
	 * if (validationErrors.length) abort.unprocessableEntity(JSON.stringify(validationErrors));
	 */
	unprocessableEntity(message?: string): never;

	/**
	 * Abort the current request and return a 429 Too Many Requests response.
	 *
	 * Use for rate limiting.
	 *
	 * @param message - Optional response message (default: "Too Many Requests")
	 *
	 * @example
	 * if (rateLimitExceeded) abort.tooManyRequests('Rate limit exceeded. Try again in 60 seconds.');
	 */
	tooManyRequests(message?: string): never;

	/**
	 * Abort the current request and return a 500 Internal Server Error response.
	 *
	 * @param message - Optional response message (default: "Internal Server Error")
	 * @param cause - Optional error that caused this internal server error
	 *
	 * @example
	 * abort.internalServerError('Database connection failed');
	 *
	 * @example
	 * try {
	 *   await database.query();
	 * } catch (error) {
	 *   abort.internalServerError('Database error', error);
	 * }
	 */
	internalServerError(message?: string, cause?: Error): never;

	/**
	 * Abort the current request and return a 503 Service Unavailable response.
	 *
	 * Use during maintenance or when service is temporarily down.
	 *
	 * @param message - Optional response message (default: "Service Unavailable")
	 *
	 * @example
	 * if (maintenanceMode) abort.serviceUnavailable('System maintenance in progress');
	 */
	serviceUnavailable(message?: string): never;

	/**
	 * Abort the current request and return a custom Response object.
	 *
	 * @param response - The Response object to return
	 * @param cause - Optional error that caused this abort
	 *
	 * @example
	 * abort.withResponse(new Response('Custom', { status: 418, headers: { 'X-Custom': 'header' } }));
	 *
	 * @example
	 * abort.withResponse(Response.json({ error: 'Not found' }, { status: 404 }));
	 */
	withResponse(response: Response, cause?: Error): never;
};

function _abort(
	status: number,
	message = "",
	headers: Headers | Record<string, string> = {},
	cause?: Error,
): never {
	const exception = AbortException.forStatus(status, message, headers, cause);

	const container = ContainerImpl.currentlyInScope();
	if (!container) {
		throw new Error("abort() can only be called within a request handler");
	}

	const locals = container.get(RequestLocals);
	if (locals.has(abortExceptionKey)) {
		// First abort wins - throw the existing one
		throw locals.get(abortExceptionKey)!;
	}
	locals.set(abortExceptionKey, exception);

	throw exception;
}

/***/
export const abort: Abort = Object.assign(_abort, {
	redirect(to: string, options?: RedirectOptions): never {
		const status = redirectStatus(options);
		_abort(status, "", { Location: to });
	},

	notFound(message = "Not Found"): never {
		_abort(404, message);
	},

	badRequest(message = "Bad Request"): never {
		_abort(400, message);
	},

	unauthorized(message = "Unauthorized"): never {
		_abort(401, message);
	},

	forbidden(message = "Forbidden"): never {
		_abort(403, message);
	},

	methodNotAllowed(message = "Method Not Allowed"): never {
		_abort(405, message);
	},

	gone(message = "Resource Gone"): never {
		_abort(410, message);
	},

	unprocessableEntity(message = "Unprocessable Entity"): never {
		_abort(422, message);
	},

	tooManyRequests(message = "Too Many Requests"): never {
		_abort(429, message);
	},

	internalServerError(message = "Internal Server Error", cause?: Error): never {
		_abort(500, message, {}, cause);
	},

	serviceUnavailable(message = "Service Unavailable"): never {
		_abort(503, message);
	},

	withResponse(response: Response, cause?: Error): never {
		const exception = new AbortException(response, cause);

		const container = ContainerImpl.currentlyInScope();
		if (!container) {
			throw new Error("abort() can only be called within a request handler");
		}

		const locals = container.get(RequestLocals);
		if (locals.has(abortExceptionKey)) {
			throw locals.get(abortExceptionKey)!;
		}
		locals.set(abortExceptionKey, exception);

		throw exception;
	},
});
