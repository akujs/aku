import { describe, expect, test } from "bun:test";
import {
	randomHex,
	randomPassword,
	randomString,
	randomUlid,
	randomUuid,
	randomUuidV4,
} from "./random.ts";

const ULID_REGEX = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const UUID_REGEX = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

describe(randomString, () => {
	test("generates empty string for size 0", () => {
		expect(randomString(0)).toBe("");
	});

	test("changes ID length", () => {
		expect(randomString(10).length).toBe(10);
		expect(randomString(50).length).toBe(50);
	});

	test("avoids pool pollution with fractional input", () => {
		randomString(2.1);
		const second = randomString(21);
		const third = randomString(21);
		expect(second).not.toBe(third);
	});
});

describe("randomHex", () => {
	test("generates with length", () => {
		expect(randomHex(0).length).toBe(0);
		expect(randomHex(5).length).toBe(5);
		expect(randomHex(100)).toMatch(/^[0-9a-f]{100}$/);
	});
});

describe(randomPassword, () => {
	test("generates password with default options", () => {
		expect(randomPassword().length).toBe(32);
		expect(typeof randomPassword()).toBe("string");
	});

	test("respects custom length", () => {
		expect(randomPassword({ length: 16 }).length).toBe(16);
		expect(randomPassword({ length: 64 }).length).toBe(64);
	});

	test("generates passwords with only letters", () => {
		const p = randomPassword({
			length: 20,
			letters: true,
			numbers: false,
			symbols: false,
			spaces: false,
		});
		expect(p).toMatch(/^[a-zA-Z]+$/);
	});

	test("generates passwords with only numbers", () => {
		const p = randomPassword({
			length: 20,
			letters: false,
			numbers: true,
			symbols: false,
			spaces: false,
		});
		expect(p).toMatch(/^[\d]+$/);
	});

	test("generates passwords with letters and numbers", () => {
		const p = randomPassword({
			length: 20,
			letters: true,
			numbers: true,
			symbols: false,
			spaces: false,
		});
		expect(p).toMatch(/^[a-zA-Z\d]+$/);
	});

	test("includes at least one character from each enabled set", () => {
		// Run multiple times to reduce chance of random failure
		for (let i = 0; i < 10; i++) {
			const p = randomPassword({
				length: 20,
				letters: true,
				numbers: true,
				symbols: true,
				spaces: false,
			});

			// Should contain at least one letter, number, and symbol
			expect(p).toMatch(/[a-zA-Z]/);
			expect(p).toMatch(/\d/);
			expect(p).toMatch(/[~!#$%^&*()\-_.,<>?/\\{}[\]|:;]/);
		}
	});

	test("includes spaces when enabled", () => {
		// Generate many to ensure at least one has a space
		let hasSpace = false;
		for (let i = 0; i < 100; i++) {
			const p = randomPassword({
				length: 20,
				letters: true,
				numbers: true,
				symbols: false,
				spaces: true,
			});
			if (p.includes(" ")) {
				hasSpace = true;
				break;
			}
		}
		expect(hasSpace).toBe(true);
	});

	test("generates unique passwords", () => {
		const passwords = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const p = randomPassword({ length: 16 });
			expect(passwords.has(p)).toBe(false);
			passwords.add(p);
		}
	});

	test("throws error when no character types enabled", () => {
		expect(() =>
			randomPassword({
				letters: false,
				numbers: false,
				symbols: false,
				spaces: false,
			}),
		).toThrow("At least one character type must be enabled");
	});
});

describe(randomUlid, () => {
	test("generates valid ULID format", () => {
		const u = randomUlid();
		expect(u.length).toBe(26);
		expect(u).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
	});

	test("generates time-ordered ulids", () => {
		const ulid1 = randomUlid(new Date("2024-01-01"));
		const ulid2 = randomUlid(new Date("2024-01-02"));
		const ulid3 = randomUlid(new Date("2024-01-03"));
		expect(ulid1 < ulid2).toBe(true);
		expect(ulid2 < ulid3).toBe(true);
	});

	test("accepts date and numeric timestamp", () => {
		const date = new Date("2024-01-03");
		const dateUlid = randomUlid(date);
		const timeUlid = randomUlid(date.getTime());
		expect(dateUlid.slice(0, 10)).toEqual(timeUlid.slice(0, 10));
	});

	test("generates unique ulids for same timestamp", () => {
		const timestamp = Date.now();
		const ulids = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const u = randomUlid(timestamp);
			expect(ulids.has(u)).toBe(false);
			ulids.add(u);
		}
	});

	test("encodes timestamp correctly - ULID spec canonical test vector", () => {
		// Canonical test vector from ULID specification
		// https://github.com/ulid/spec

		const timestamp = 1469918176385;
		const ulidValue = randomUlid(timestamp);

		// Check that timestamp portion matches (first 10 characters)
		const timestampPortion = ulidValue.slice(0, 10);
		expect(timestampPortion).toBe("01ARYZ6S41");

		// Verify it's a valid ULID
		expect(ULID_REGEX.test(ulidValue)).toBe(true);
		expect(ulidValue.length).toBe(26);
	});
});

describe(randomUuidV4, () => {
	test("generates valid UUID v4", () => {
		const u = randomUuidV4();
		expect(UUID_REGEX.test(u)).toBeTrue();
		expect(u.charAt(14)).toBe("4");
	});

	test("generates unique uuids", () => {
		const uuids = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const u = randomUuidV4();
			expect(uuids.has(u)).toBe(false);
			uuids.add(u);
		}
	});

	test("has correct version number", () => {
		const u = randomUuidV4();
		expect(u.charAt(14)).toBe("4");
	});
});

describe(randomUuid, () => {
	test("generates valid UUID v7", () => {
		const u = randomUuid();
		expect(UUID_REGEX.test(u)).toBeTrue();
		expect(u.charAt(14)).toBe("7");
	});

	test("has correct version number", () => {
		const u = randomUuid();
		expect(u.charAt(14)).toBe("7");
	});

	test("accepts Date timestamp", () => {
		const date = new Date("2024-01-01T00:00:00Z");
		const u = randomUuid(date);
		expect(u).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
	});

	test("accepts date and numeric timestamp", () => {
		const date = new Date("2024-01-03");
		const dateUuid = randomUuid(date);
		const timeUuid = randomUuid(date.getTime());
		expect(dateUuid.slice(0, 14)).toEqual(timeUuid.slice(0, 14));
	});

	test("generates time-ordered UUIDs", () => {
		const uuid1 = randomUuid(new Date("2024-01-01"));
		const uuid2 = randomUuid(new Date("2024-01-02"));
		const uuid3 = randomUuid(new Date("2024-01-03"));

		// Later timestamps should have lexicographically greater UUIDs
		expect(uuid1 < uuid2).toBe(true);
		expect(uuid2 < uuid3).toBe(true);
	});

	test("generates unique UUIDs for same timestamp", () => {
		const timestamp = Date.now();
		const uuids = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const u = randomUuid(timestamp);
			expect(uuids.has(u)).toBe(false);
			uuids.add(u);
		}
	});

	test("encodes timestamp correctly - RFC 9562 canonical test vector", () => {
		// Canonical test vector from RFC 9562 Appendix A.6
		// https://www.rfc-editor.org/rfc/rfc9562.html#name-example-of-a-uuidv7-value

		const timestamp = 1645557742000;
		const u = randomUuid(timestamp);

		const timestampPortion = u.slice(0, 13).replace("-", ""); // "017F22E279B0"
		expect(timestampPortion.toUpperCase()).toBe("017F22E279B0");

		expect(u.charAt(14)).toBe("7");
		expect(UUID_REGEX.test(u)).toBe(true);
	});
});
