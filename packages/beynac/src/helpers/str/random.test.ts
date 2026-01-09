import { describe, expect, test } from "bun:test";
import { isUlid, isUuid, password, random, randomHex, ulid, uuid, uuidV4 } from "./random.ts";

describe(random, () => {
	test("generates empty string for size 0", () => {
		expect(random(0)).toBe("");
	});

	test("changes ID length", () => {
		expect(random(10).length).toBe(10);
		expect(random(50).length).toBe(50);
	});

	test("avoids pool pollution with fractional input", () => {
		random(2.1);
		const second = random(21);
		const third = random(21);
		expect(second).not.toBe(third);
	});
});

describe("strRandomHex", () => {
	test("generates with length", () => {
		expect(randomHex(0).length).toBe(0);
		expect(randomHex(5).length).toBe(5);
		expect(randomHex(100)).toMatch(/^[0-9a-f]{100}$/);
	});
});

describe(password, () => {
	test("generates password with default options", () => {
		expect(password().length).toBe(32);
		expect(typeof password()).toBe("string");
	});

	test("respects custom length", () => {
		expect(password({ length: 16 }).length).toBe(16);
		expect(password({ length: 64 }).length).toBe(64);
	});

	test("generates passwords with only letters", () => {
		const p = password({
			length: 20,
			letters: true,
			numbers: false,
			symbols: false,
			spaces: false,
		});
		expect(p).toMatch(/^[a-zA-Z]+$/);
	});

	test("generates passwords with only numbers", () => {
		const p = password({
			length: 20,
			letters: false,
			numbers: true,
			symbols: false,
			spaces: false,
		});
		expect(p).toMatch(/^[\d]+$/);
	});

	test("generates passwords with letters and numbers", () => {
		const p = password({
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
			const p = password({
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
			const p = password({
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
			const p = password({ length: 16 });
			expect(passwords.has(p)).toBe(false);
			passwords.add(p);
		}
	});

	test("throws error when no character types enabled", () => {
		expect(() =>
			password({
				letters: false,
				numbers: false,
				symbols: false,
				spaces: false,
			}),
		).toThrow("At least one character type must be enabled");
	});
});

describe(ulid, () => {
	test("generates valid ULID format", () => {
		const u = ulid();
		expect(u.length).toBe(26);
		expect(u).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/);
	});

	test("generates time-ordered ulids", () => {
		const ulid1 = ulid(new Date("2024-01-01"));
		const ulid2 = ulid(new Date("2024-01-02"));
		const ulid3 = ulid(new Date("2024-01-03"));
		expect(ulid1 < ulid2).toBe(true);
		expect(ulid2 < ulid3).toBe(true);
	});

	test("accepts date and numeric timestamp", () => {
		const date = new Date("2024-01-03");
		const dateUlid = ulid(date);
		const timeUlid = ulid(date.getTime());
		expect(dateUlid.slice(0, 10)).toEqual(timeUlid.slice(0, 10));
	});

	test("generates unique ulids for same timestamp", () => {
		const timestamp = Date.now();
		const ulids = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const u = ulid(timestamp);
			expect(ulids.has(u)).toBe(false);
			ulids.add(u);
		}
	});

	test("encodes timestamp correctly - ULID spec canonical test vector", () => {
		// Canonical test vector from ULID specification
		// https://github.com/ulid/spec

		const timestamp = 1469918176385;
		const ulidValue = ulid(timestamp);

		// Check that timestamp portion matches (first 10 characters)
		const timestampPortion = ulidValue.slice(0, 10);
		expect(timestampPortion).toBe("01ARYZ6S41");

		// Verify it's a valid ULID
		expect(isUlid(ulidValue)).toBe(true);
		expect(ulidValue.length).toBe(26);
	});
});

describe(isUlid, () => {
	test("validates correct ULID format", () => {
		expect(isUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(true);
		expect(isUlid(ulid())).toBe(true);
	});

	test("rejects invalid formats", () => {
		expect(isUlid("not-a-ulid")).toBe(false);
		expect(isUlid("01ARZ3NDEKTSV4RRFFQ69G5FA")).toBe(false); // too short
		expect(isUlid("01ARZ3NDEKTSV4RRFFQ69G5FAVV")).toBe(false); // too long
		expect(isUlid("01arz3ndektsv4rrffq69g5fav")).toBe(false); // lowercase
		expect(isUlid("01ARZ3NDEKTSV4RRFFQ69G5FAI")).toBe(false); // contains I
		expect(isUlid("01ARZ3NDEKTSV4RRFFQ69G5FAL")).toBe(false); // contains L
		expect(isUlid("01ARZ3NDEKTSV4RRFFQ69G5FAO")).toBe(false); // contains O
		expect(isUlid("01ARZ3NDEKTSV4RRFFQ69G5FAU")).toBe(false); // contains U
		expect(isUlid("")).toBe(false);
		expect(isUlid(null!)).toBe(false);
		expect(isUlid(undefined!)).toBe(false);
		expect(isUlid(123 as any)).toBe(false);
	});
});

describe(uuidV4, () => {
	test("generates valid UUID v4", () => {
		const uuid = uuidV4();
		expect(isUuid(uuid, 4)).toBeTrue();
	});

	test("generates unique uuids", () => {
		const uuids = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const uuid = uuidV4();
			expect(uuids.has(uuid)).toBe(false);
			uuids.add(uuid);
		}
	});

	test("has correct version number", () => {
		const uuid = uuidV4();
		expect(uuid.charAt(14)).toBe("4");
	});
});

describe(uuid, () => {
	test("generates valid UUID v7", () => {
		const u = uuid();
		expect(isUuid(u, 7)).toBeTrue();
	});

	test("has correct version number", () => {
		const u = uuid();
		expect(u.charAt(14)).toBe("7");
	});

	test("accepts Date timestamp", () => {
		const date = new Date("2024-01-01T00:00:00Z");
		const u = uuid(date);
		expect(u).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
	});

	test("accepts date and numeric timestamp", () => {
		const date = new Date("2024-01-03");
		const dateUuid = uuid(date);
		const timeUuid = uuid(date.getTime());
		expect(dateUuid.slice(0, 14)).toEqual(timeUuid.slice(0, 14));
	});

	test("generates time-ordered UUIDs", () => {
		const uuid1 = uuid(new Date("2024-01-01"));
		const uuid2 = uuid(new Date("2024-01-02"));
		const uuid3 = uuid(new Date("2024-01-03"));

		// Later timestamps should have lexicographically greater UUIDs
		expect(uuid1 < uuid2).toBe(true);
		expect(uuid2 < uuid3).toBe(true);
	});

	test("generates unique UUIDs for same timestamp", () => {
		const timestamp = Date.now();
		const uuids = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			const u = uuid(timestamp);
			expect(uuids.has(u)).toBe(false);
			uuids.add(u);
		}
	});

	test("encodes timestamp correctly - RFC 9562 canonical test vector", () => {
		// Canonical test vector from RFC 9562 Appendix A.6
		// https://www.rfc-editor.org/rfc/rfc9562.html#name-example-of-a-uuidv7-value

		const timestamp = 1645557742000;
		const u = uuid(timestamp);

		const timestampPortion = u.slice(0, 13).replace("-", ""); // "017F22E279B0"
		expect(timestampPortion.toUpperCase()).toBe("017F22E279B0");

		expect(u.charAt(14)).toBe("7");
		expect(isUuid(u, 7)).toBe(true);
	});
});

describe(isUuid, () => {
	test("validates correct UUID format", () => {
		expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
		expect(isUuid("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
	});

	test("rejects invalid formats", () => {
		expect(isUuid("not-a-uuid")).toBe(false);
		expect(isUuid("550e8400-e29b-41d4-a716")).toBe(false);
		expect(isUuid("550e8400e29b41d4a716446655440000")).toBe(false);
		expect(isUuid("")).toBe(false);
		expect(isUuid(null)).toBe(false);
		expect(isUuid(undefined)).toBe(false);
		expect(isUuid(123)).toBe(false);
	});

	test("validates specific UUID versions", () => {
		const v4 = uuidV4();
		expect(isUuid(v4, 4)).toBe(true);
		expect(isUuid(v4, 7)).toBe(false);

		const v7 = uuid();
		expect(isUuid(v7, 7)).toBe(true);
		expect(isUuid(v7, 4)).toBe(false);
	});

	test("validates any version when version not specified", () => {
		expect(isUuid(uuidV4())).toBe(true);
		expect(isUuid(uuid())).toBe(true);
	});
});
