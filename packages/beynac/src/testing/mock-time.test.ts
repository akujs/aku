import { afterEach, describe, expect, test } from "bun:test";
import { durationStringToDate } from "../helpers/time/time-entry-point.ts";
import { getPrototypeChain } from "../utils.ts";
import { mockCurrentTime, resetMockTime } from "./mock-time.ts";
import { resetAllMocks } from "./mocks.ts";

afterEach(() => {
	resetMockTime();
});

describe("Time mocking", () => {
	test("Date global", () => {
		// Capture original state
		const originalDate = Date;
		const originalDateNow = Date.now;
		const originalDateParse = Date.parse;
		const originalDateUTC = Date.UTC;
		const originalDateToString = Date.toString();
		const originalDateInstance = new Date("2025-01-01T00:00:00Z");
		const originalConstructor = originalDateInstance.constructor;
		const originalPrototypeChain = Array.from(getPrototypeChain(originalDateInstance));
		const beforeHasOwnNow = Object.hasOwn(Date, "now");
		const beforeHasOwnParse = Object.hasOwn(Date, "parse");
		const beforeHasOwnUTC = Object.hasOwn(Date, "UTC");
		const startTime = Date.now();

		// First mocking of time
		const timestamp1 = 1735732800000; // 2025-01-01T12:00:00Z
		mockCurrentTime(timestamp1);

		expect(Date.now()).toBe(timestamp1);

		// Verify new Date() with no args returns mocked time
		const mockedDate1 = new Date();
		expect(mockedDate1.getTime()).toBe(timestamp1);
		expect(mockedDate1).toBeInstanceOf(originalDate);

		// Verify Date with explicit arguments still works normally
		const specificDate = new Date("2024-06-15T10:30:00Z");
		expect(specificDate.getTime()).toBe(new Date("2024-06-15T10:30:00Z").getTime());
		const timestampDate = new Date(1234567890000);
		expect(timestampDate.getTime()).toBe(1234567890000);

		// Verify static methods work
		const parsed = Date.parse("2024-12-31T23:59:59Z");
		expect(parsed).toBe(new Date("2024-12-31T23:59:59Z").getTime());
		const utc = Date.UTC(2024, 11, 31, 23, 59, 59);
		expect(utc).toBe(new Date("2024-12-31T23:59:59Z").getTime());

		// Verify identity and observable properties preserved
		expect(Date.toString()).toBe(originalDateToString);
		expect(mockedDate1.constructor).toBe(originalConstructor);
		const mockedPrototypeChain = Array.from(getPrototypeChain(mockedDate1));
		expect(mockedPrototypeChain).toEqual(originalPrototypeChain);

		// Verify ownership patterns preserved
		expect(Object.hasOwn(Date, "now")).toBe(beforeHasOwnNow);
		expect(Object.hasOwn(Date, "parse")).toBe(beforeHasOwnParse);
		expect(Object.hasOwn(Date, "UTC")).toBe(beforeHasOwnUTC);

		// nanoseconds mocking of time
		const mockedDate2 = new Date("2025-06-15T18:30:00Z");
		mockCurrentTime(mockedDate2);

		// Verify updated values
		expect(Date.now()).toBe(mockedDate2.getTime());
		expect(new Date().getTime()).toBe(mockedDate2.getTime());

		resetMockTime();

		// Verify original state restored
		expect(Date).toBe(originalDate);
		expect(Date.now).toBe(originalDateNow);
		expect(Date.parse).toBe(originalDateParse);
		expect(Date.UTC).toBe(originalDateUTC);

		// Verify elapsed time is reasonable (0-100ms)
		const endTime = Date.now();
		const elapsed = endTime - startTime;
		expect(elapsed).toBeGreaterThanOrEqual(0);
		expect(elapsed).toBeLessThan(100);
	});

	test("process.hrtime.bigint", () => {
		const originalHrtimeBigint = process.hrtime.bigint;
		const startTimeNs = process.hrtime.bigint();

		const mockedDate = new Date("2025-01-01T12:00:00Z");
		mockCurrentTime(mockedDate);

		const result = process.hrtime.bigint();
		const expectedNs = BigInt(mockedDate.getTime()) * 1_000_000n;
		expect(result).toBe(expectedNs);

		resetMockTime();

		expect(process.hrtime.bigint).toBe(originalHrtimeBigint);

		// Verify elapsed time is reasonable (0-100ms = 0-100,000,000ns)
		const endTimeNs = process.hrtime.bigint();
		const elapsedNs = endTimeNs - startTimeNs;
		expect(elapsedNs).toBeGreaterThanOrEqual(0n);
		expect(elapsedNs).toBeLessThan(100_000_000n);
	});

	test("process.hrtime", () => {
		const originalHrtime = process.hrtime;
		const startTime = process.hrtime();

		const mockedDate = new Date("2025-01-01T12:00:00Z");
		mockCurrentTime(mockedDate);

		// Verify returns mocked time as [seconds, nanoseconds]
		const result = process.hrtime();
		const expectedNs = BigInt(mockedDate.getTime()) * 1_000_000n;
		const expectedSeconds = Number(expectedNs / 1_000_000_000n);
		const expectedNanoseconds = Number(expectedNs % 1_000_000_000n);
		expect(result).toEqual([expectedSeconds, expectedNanoseconds]);

		// Verify differential timing works
		const firstTime = process.hrtime();
		mockCurrentTime(mockedDate.getTime() + 5001); // 5 seconds + 1ms later
		const diff = process.hrtime(firstTime);
		expect(diff).toEqual([5, 1_000_000]); // 5 seconds, 1,000,000 nanoseconds

		resetMockTime();

		expect(process.hrtime).toBe(originalHrtime);

		// Verify elapsed time is reasonable (0-100ms)
		const endTime = process.hrtime(startTime);
		const elapsedNs = BigInt(endTime[0]) * 1_000_000_000n + BigInt(endTime[1]);
		expect(elapsedNs).toBeGreaterThanOrEqual(0n);
		expect(elapsedNs).toBeLessThan(100_000_000n);
	});

	test("affects durationStringToDate when no relativeTo option", () => {
		const mockedDate = new Date("2025-01-01T12:00:00Z");
		mockCurrentTime(mockedDate);

		const result = durationStringToDate("1h");
		expect(result.getTime()).toBe(mockedDate.getTime() + 60 * 60 * 1000);
	});
});

describe("Time mocking edge cases", () => {
	test("can be called multiple times safely", () => {
		const mockedDate = new Date("2025-01-01T12:00:00Z");
		mockCurrentTime(mockedDate);

		resetMockTime();
		resetMockTime();
		resetMockTime();

		const now = Date.now();
		const actualNow = new Date().getTime();
		expect(Math.abs(now - actualNow)).toBeLessThan(100);
	});

	test("resets properly even after multiple mock calls", () => {
		mockCurrentTime(new Date("2025-01-01T12:00:00Z"));
		mockCurrentTime(new Date("2025-06-15T18:30:00Z"));
		mockCurrentTime(new Date("2025-12-31T23:59:59Z"));

		resetMockTime();

		const now = Date.now();
		const actualNow = new Date().getTime();
		expect(Math.abs(now - actualNow)).toBeLessThan(100);
	});

	test("allows mock/reset cycles to work correctly", () => {
		// First cycle
		const firstMock = new Date("2025-01-01T12:00:00Z");
		mockCurrentTime(firstMock);
		expect(Date.now()).toBe(firstMock.getTime());
		resetMockTime();

		// Second cycle
		const secondMock = new Date("2025-06-15T18:30:00Z");
		mockCurrentTime(secondMock);
		expect(Date.now()).toBe(secondMock.getTime());
		resetMockTime();

		// Verify we're back to actual time
		const now = Date.now();
		const actualNow = new Date().getTime();
		expect(Math.abs(now - actualNow)).toBeLessThan(100);
	});

	test("resetAllMocks resets time mocks", () => {
		const mockedDate = new Date("2025-01-01T12:00:00Z");
		mockCurrentTime(mockedDate);

		expect(Date.now()).toBe(mockedDate.getTime());

		resetAllMocks();

		// Verify we're back to actual time
		const now = Date.now();
		const actualNow = new Date().getTime();
		expect(Math.abs(now - actualNow)).toBeLessThan(100);
	});
});
