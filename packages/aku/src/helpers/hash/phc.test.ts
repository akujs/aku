import { describe, expect, test } from "bun:test";
import { formatPhc, parsePhc } from "./phc.ts";
import { testVectors } from "./phc-test-vectors.ts";

describe(parsePhc, () => {
	test.each(Object.entries(testVectors))("parses: %s", (phcString, expected) => {
		const result = parsePhc(phcString);
		expect(result).toEqual(expected);
	});

	test("throws on invalid format", () => {
		expect(() => parsePhc("invalid")).toThrow("Invalid PHC format");
		expect(() => parsePhc("$onlyid")).toThrow("Invalid PHC format");
		expect(() => parsePhc("noLeadingDollar$id$params")).toThrow("Invalid PHC format");
	});
});

describe(formatPhc, () => {
	test.each(Object.entries(testVectors))("formats: %s", (expected, fields) => {
		const result = formatPhc(fields);
		expect(result).toBe(expected);
	});

	test("removes base64 padding", () => {
		// Create a buffer that would have padding (length not divisible by 3)
		const salt = Buffer.from("test"); // "dGVzdA==" with padding, should become "dGVzdA"
		const result = formatPhc({
			id: "test",
			params: { x: 1 },
			salt,
		});
		expect(result).toBe("$test$x=1$dGVzdA");
		// Check that the salt portion (after the last $) doesn't have padding
		const saltPortion = result.split("$").pop();
		expect(saltPortion).toBe("dGVzdA");
		expect(saltPortion).not.toContain("=");
	});
});

describe("PHC round-trip", () => {
	test.each(Object.entries(testVectors))("round-trip: %s", (_phcString, fields) => {
		const formatted = formatPhc(fields);
		const parsed = parsePhc(formatted);

		// Compare non-Buffer fields
		expect(parsed.id).toBe(fields.id);
		if (fields.version !== undefined) {
			expect(parsed.version).toBe(fields.version);
		}
		expect(parsed.params).toEqual(fields.params);

		// Compare Buffer fields using .equals()
		if (fields.salt) {
			expect(parsed.salt?.equals(fields.salt)).toBe(true);
		} else {
			expect(parsed.salt).toBeUndefined();
		}

		if (fields.hash) {
			expect(parsed.hash?.equals(fields.hash)).toBe(true);
		} else {
			expect(parsed.hash).toBeUndefined();
		}
	});
});
