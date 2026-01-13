import { mockable } from "../../testing/mocks.ts";

/**
 * Return a promise that resolves after a given number of milliseconds.
 */
export const sleep: (ms: number) => Promise<void> = mockable(function sleep(
	ms: number,
): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
});
