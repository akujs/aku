import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";

/**
 * Provides the ability to keep the environment alive until async tasks complete
 */
export interface KeepAlive {
	/**
	 * Register a task to keep the environment alive until it completes. Some
	 * serverless runtimes like Lambda and Cloudflare will shut down the
	 * environment as soon as the request has been sent, potentially cutting
	 * off background tasks while they are running. Registering tasks using
	 * this API keeps the environment alive until all tasks have completed.
	 *
	 * @example
	 * // Queue a task to send an email
	 * KeepAlive.waitUntil(sendEmail({
	 *     to: user.email,
	 *     subject: "Welcome!",
	 *     body: "Thanks for signing up"
	 * }));
	 */
	waitUntil(task: Promise<void>): void;
}

/***/
export const KeepAlive: TypeToken<KeepAlive> = createTypeToken("KeepAlive");
