import { sleep } from "./sleep.ts";

/**
 * Options for `withRetry`.
 */
export interface RetryOptions {
	/**
	 * Initial delay in ms before first retry.
	 *
	 * @default 100
	 */
	startingDelay?: number | undefined;

	/**
	 * After each failure, the delay until the next retry is multiplied by this
	 * factor, so `2` would double the delay on each retry.
	 *
	 * @default 2
	 */
	backoffFactor?: number | undefined;

	/**
	 * Maximum delay. The function will be retried until maxDelay or maxAttempts
	 * is reached, whichever comes first.
	 *
	 * @default Infinity
	 */
	maxDelay?: number | undefined;

	/**
	 * Maximum number of retry attempts. The function will be retried until
	 * maxDelay or maxAttempts is reached, whichever comes first.
	 *
	 * @default 5
	 */
	maxAttempts?: number | undefined;

	/**
	 * Add a random factor to the delay. At value `1`, the delay will be
	 * multiplied by a random number between 0 and 2.
	 *
	 * Random jitter prevents the situation where two tasks that cause each
	 * other to fail when run simultaneously keep retrying in lockstep, always
	 * failing because they retry with the same delay.
	 *
	 * @default 1
	 */
	jitterFactor?: number | undefined;

	/**
	 * Determines if an error should trigger a retry. By default, any error
	 * thrown form the function will trigger a retry.
	 *
	 * It is recommended to always provide a `shouldRetry` function to avoid
	 * retrying on unexpected and unrecoverable errors.
	 */
	shouldRetry?: ((error: unknown) => boolean) | undefined;
}

/**
 * Execute an async function with exponential backoff and jitter on failure.
 *
 * Retries the function until it succeeds, `maxAttempts` is reached, or
 * `shouldRetry` returns false for an error.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	{
		startingDelay = 100,
		backoffFactor = 2,
		maxDelay = Infinity,
		maxAttempts = 5,
		jitterFactor = 1,
		shouldRetry,
	}: RetryOptions = {},
): Promise<T> {
	let attempt = 0;

	while (true) {
		try {
			return await fn();
		} catch (error) {
			attempt++;

			if (attempt >= maxAttempts || (shouldRetry && !shouldRetry(error))) {
				throw error;
			}

			const baseDelay = Math.min(startingDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
			const jitterAmount = baseDelay * (Math.random() * 2 - 1) * jitterFactor;
			const actualDelay = baseDelay + jitterAmount;

			await sleep(actualDelay);
		}
	}
}
