import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mock, resetAllMocks } from "../../testing/mocks.js";
import { type RetryOptions, withRetry } from "./retry.js";
import { sleep } from "./sleep.js";

afterEach(() => {
	resetAllMocks();
});

describe(withRetry, () => {
	test("returns result on first success", async () => {
		const result = await testRetry({}, 0);
		expect(result).toEqual({ returned: "success" });
	});

	test("retries and eventually succeeds", async () => {
		const result = await testRetry({ jitterFactor: 0 }, 2);
		expect(result).toEqual({ delays: [100, 200], returned: "success" });
	});

	test("throws after maxAttempts exceeded", async () => {
		const result = await testRetry({ maxAttempts: 3, jitterFactor: 0 });
		expect(result).toEqual({ delays: [100, 200], threw: "fail" });
	});

	test("throws immediately when shouldRetry returns false", async () => {
		const result = await testRetry({ shouldRetry: () => false });
		expect(result).toEqual({ threw: "fail" });
	});

	test("shouldRetry receives the error", async () => {
		const errors: unknown[] = [];
		await testRetry({
			maxAttempts: 2,
			shouldRetry: (err) => {
				errors.push(err);
				return true;
			},
		});
		expect(errors.length).toBe(1);
		expect(errors[0]).toBeInstanceOf(Error);
		expect((errors[0] as Error).message).toBe("fail");
	});

	test("uses exponential backoff", async () => {
		const result = await testRetry({
			startingDelay: 1,
			backoffFactor: 2,
			jitterFactor: 0,
			maxAttempts: 4,
		});
		expect(result).toEqual({ delays: [1, 2, 4], threw: "fail" });
	});

	test("respects maxDelay", async () => {
		const result = await testRetry({
			startingDelay: 1,
			backoffFactor: 10,
			maxDelay: 5,
			jitterFactor: 0,
			maxAttempts: 5,
		});
		expect(result).toEqual({ delays: [1, 5, 5, 5], threw: "fail" });
	});

	test("applies jitter correctly", async () => {
		const randomSpy = spyOn(Math, "random")
			.mockReturnValueOnce(0) // min: 1 + 1 * (0 * 2 - 1) * 1 = 0
			.mockReturnValueOnce(0.5) // mid: 1 + 1 * (0.5 * 2 - 1) * 1 = 1
			.mockReturnValueOnce(1); // max: 1 + 1 * (1 * 2 - 1) * 1 = 2

		const result = await testRetry({
			startingDelay: 1,
			backoffFactor: 1,
			jitterFactor: 1,
			maxAttempts: 4,
		});

		expect(result).toEqual({ delays: [0, 1, 2], threw: "fail" });
		randomSpy.mockRestore();
	});

	test("jitterFactor of 0 produces no jitter", async () => {
		const randomSpy = spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(1);

		const result = await testRetry({
			startingDelay: 1,
			backoffFactor: 1,
			jitterFactor: 0,
			maxAttempts: 3,
		});

		expect(result).toEqual({ delays: [1, 1], threw: "fail" });
		randomSpy.mockRestore();
	});
});

interface TestRetryResult {
	delays?: number[];
	threw?: string;
	returned?: string;
}

async function testRetry(
	options: RetryOptions,
	attemptsUntilSuccess = Infinity,
	returnValue = "success",
): Promise<TestRetryResult> {
	const delays: number[] = [];

	mock(sleep, async (ms: number) => {
		delays.push(ms);
	});

	const result: TestRetryResult = {};

	try {
		result.returned = await withRetry(async () => {
			if (attemptsUntilSuccess > 0) {
				--attemptsUntilSuccess;
				throw new Error("fail");
			}
			return returnValue;
		}, options);
	} catch (error) {
		result.threw = error instanceof Error ? error.message : String(error);
	}

	if (delays.length > 0) {
		result.delays = delays;
	}

	return result;
}
