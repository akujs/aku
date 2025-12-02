import { onResetAllMocks } from "./mocks.ts";

let originalDate: DateConstructor | null = null;
let originalDateNow: (() => number) | null = null;
let originalHrtime: typeof process.hrtime | null = null;
let originalHrtimeBigint: (() => bigint) | null = null;
let mockedTime: number | null = null;

/**
 * Mock the current time for testing purposes.
 *
 * Patches Date.now(), new Date(), process.hrtime(), and process.hrtime.bigint() to return the mocked time.
 *
 * NOTE: If your test framework provides methods for mocking time, you are
 * advised to use those methods instead. Using both this time mocking function
 * AND your framework's could lead to unexpected results.
 *
 * @param date - The date to use as "now" (Date object or millisecond timestamp)
 * @example
 * mockCurrentTime(new Date("2025-01-01T12:00:00Z"));
 * mockCurrentTime(1735732800000); // Same as above
 * Date.now(); // Returns 2025-01-01T12:00:00Z timestamp
 * new Date(); // Returns 2025-01-01T12:00:00Z
 * process.hrtime.bigint(); // Returns mocked time in nanoseconds
 * durationStringToDate("1h"); // Returns 2025-01-01T13:00:00Z
 */
export function mockCurrentTime(date: Date | number = new Date("2020-01-01T00:00:00Z")): void {
	mockedTime = typeof date === "number" ? date : new Date(date).getTime();

	// Save originals and patch on first mock
	if (originalDate === null) {
		originalDate = globalThis.Date;
		originalDateNow = globalThis.Date.now;

		// Patch Date constructor
		const MockedDate = function (this: Date, ...args: unknown[]): Date | string {
			// When called as constructor with no arguments, return mocked time
			if (new.target && args.length === 0) {
				return new originalDate!(mockedTime!);
			}
			// When called as constructor with arguments, use original behavior
			if (new.target) {
				return new originalDate!(...(args as []));
			}
			// When called as function (not constructor), return string like original Date
			return originalDate!();
		} as unknown as DateConstructor;

		// Copy all static properties and methods from original Date
		Object.setPrototypeOf(MockedDate, originalDate!);
		Object.getOwnPropertyNames(originalDate!).forEach((prop) => {
			const descriptor = Object.getOwnPropertyDescriptor(originalDate!, prop);
			if (descriptor) {
				Object.defineProperty(MockedDate, prop, descriptor);
			}
		});

		Object.defineProperty(MockedDate, "now", {
			value: () => mockedTime!,
			writable: true,
			enumerable: false,
			configurable: true,
		});

		Object.defineProperty(MockedDate, "toString", {
			value: () => originalDate!.toString(),
			writable: true,
			enumerable: false,
			configurable: true,
		});

		Object.defineProperty(MockedDate, "prototype", {
			value: originalDate!.prototype,
			writable: false,
			enumerable: false,
			configurable: false,
		});

		globalThis.Date = MockedDate;

		// Patch process.hrtime() and process.hrtime.bigint()
		originalHrtime = process.hrtime;
		// eslint-disable-next-line @typescript-eslint/unbound-method
		originalHrtimeBigint = process.hrtime.bigint;

		// Create new hrtime function that returns mocked time
		const mockHrtime = ((time?: [number, number]) => {
			const mockedNs = BigInt(mockedTime!) * 1_000_000n;

			if (time) {
				// When called with previous time, return difference
				const previousNs = BigInt(time[0]) * 1_000_000_000n + BigInt(time[1]);
				const diffNs = mockedNs - previousNs;
				const seconds = Number(
					// BigInt division preserves integers
					diffNs / 1_000_000_000n,
				);
				const nanoseconds = Number(diffNs % 1_000_000_000n);
				return [seconds, nanoseconds];
			}

			// When called without arguments, return absolute time
			const seconds = Number(mockedNs / 1_000_000_000n);
			const nanoseconds = Number(mockedNs % 1_000_000_000n);
			return [seconds, nanoseconds];
		}) as typeof process.hrtime;

		// Add bigint method to mockHrtime
		mockHrtime.bigint = () => BigInt(mockedTime!) * 1_000_000n;

		process.hrtime = mockHrtime;
	}
}

/**
 * Reset time mocking, returning to using the actual current time.
 * Restores original Date constructor, Date.now(), process.hrtime(), and process.hrtime.bigint().
 *
 * @example
 * mockCurrentTime(new Date("2025-01-01"));
 * // ... tests ...
 * resetMockTime();
 * Date.now(); // Returns actual current time
 * process.hrtime.bigint(); // Returns actual current time
 * durationStringToDate("1h"); // Returns actual time + 1 hour
 */
export function resetMockTime(): void {
	if (originalDate !== null) {
		globalThis.Date = originalDate;
		originalDate = null;
	}
	if (originalDateNow !== null) {
		globalThis.Date.now = originalDateNow;
		originalDateNow = null;
	}
	if (originalHrtime !== null) {
		process.hrtime = originalHrtime;
		originalHrtime = null;
	}
	if (originalHrtimeBigint !== null) {
		process.hrtime.bigint = originalHrtimeBigint;
		originalHrtimeBigint = null;
	}
	mockedTime = null;
}

// Register time mock reset with the global reset system
onResetAllMocks(resetMockTime);
