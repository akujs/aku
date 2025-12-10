import { describe, expect, test } from "bun:test";
import { durationStringToDate, durationStringToMs } from "./time/time-entry-point.ts";

describe(durationStringToMs, () => {
	test("parses 1h as milliseconds", () => {
		expect(durationStringToMs("1h")).toBe(60 * 60 * 1000);
	});

	test("parses 5d as milliseconds", () => {
		expect(durationStringToMs("5d")).toBe(5 * 24 * 60 * 60 * 1000);
	});

	test("parses 30m as milliseconds", () => {
		expect(durationStringToMs("30m")).toBe(30 * 60 * 1000);
	});

	test("parses 10s as milliseconds", () => {
		expect(durationStringToMs("10s")).toBe(10 * 1000);
	});

	test("parses 500ms as milliseconds", () => {
		expect(durationStringToMs("500ms")).toBe(500);
	});

	test("parses combined 5d4h correctly", () => {
		expect(durationStringToMs("5d4h")).toBe((5 * 24 + 4) * 60 * 60 * 1000);
	});

	test("parses combined 1h30m15s correctly", () => {
		expect(durationStringToMs("1h30m15s")).toBe((60 * 60 + 30 * 60 + 15) * 1000);
	});

	test("parses 1y as ~365 days in milliseconds", () => {
		expect(durationStringToMs("1y")).toBe(365 * 24 * 60 * 60 * 1000);
	});

	test("parses 1w as 7 days in milliseconds", () => {
		expect(durationStringToMs("1w")).toBe(7 * 24 * 60 * 60 * 1000);
	});

	test("allows zero duration", () => {
		expect(durationStringToMs("0ms")).toBe(0);
		expect(durationStringToMs("0s")).toBe(0);
		expect(durationStringToMs("0h")).toBe(0);
	});

	test("throws on invalid format", () => {
		expect(() => durationStringToMs("xyz")).toThrow(/Invalid duration format/);
	});

	test("throws on empty string", () => {
		expect(() => durationStringToMs("")).toThrow(/Invalid duration format/);
	});

	test("handles complex combined format", () => {
		const expected =
			365 * 24 * 60 * 60 * 1000 +
			2 * 7 * 24 * 60 * 60 * 1000 +
			3 * 24 * 60 * 60 * 1000 +
			4 * 60 * 60 * 1000 +
			5 * 60 * 1000 +
			6 * 1000 +
			7;
		expect(durationStringToMs("1y2w3d4h5m6s7ms")).toBe(expected);
	});

	test("accepts components in any order", () => {
		expect(durationStringToMs("5h3d")).toBe((3 * 24 + 5) * 60 * 60 * 1000);
		expect(durationStringToMs("30m1h")).toBe((60 + 30) * 60 * 1000);
		expect(durationStringToMs("15s1h30m")).toBe((60 * 60 + 30 * 60 + 15) * 1000);
	});

	test("throws on duplicate components", () => {
		expect(() => durationStringToMs("3h4d3h")).toThrow(/Duplicate duration component "h"/);
		expect(() => durationStringToMs("1d2d")).toThrow(/Duplicate duration component "d"/);
		expect(() => durationStringToMs("5m10s5m")).toThrow(/Duplicate duration component "m"/);
	});
});

describe(durationStringToDate, () => {
	test("Date object passed through unchanged", () => {
		const date = new Date("2025-12-31");
		expect(durationStringToDate(date)).toEqual(date);
		expect(durationStringToDate(date)).not.toBe(date);
	});

	test("adds duration to current time by default", () => {
		const result = durationStringToDate("1h");
		const expected = Date.now() + 60 * 60 * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("subtracts duration when inPast is true", () => {
		const result = durationStringToDate("1h", { inPast: true });
		const expected = Date.now() - 60 * 60 * 1000;
		expect(Math.abs(result.getTime() - expected)).toBeLessThan(100);
	});

	test("uses relativeTo option for future dates", () => {
		const base = new Date("2025-01-01T00:00:00Z");
		const result = durationStringToDate("1h", { relativeTo: base });
		expect(result.getTime()).toBe(base.getTime() + 60 * 60 * 1000);
	});

	test("uses relativeTo option for past dates", () => {
		const base = new Date("2025-01-01T00:00:00Z");
		const result = durationStringToDate("1h", { relativeTo: base, inPast: true });
		expect(result.getTime()).toBe(base.getTime() - 60 * 60 * 1000);
	});

	test("handles combined duration format", () => {
		const base = new Date("2025-01-01T00:00:00Z");
		const result = durationStringToDate("1d12h", { relativeTo: base });
		expect(result.getTime()).toBe(base.getTime() + (24 + 12) * 60 * 60 * 1000);
	});

	test("throws on invalid format", () => {
		expect(() => durationStringToDate("xyz")).toThrow(/Invalid duration format/);
	});
});
