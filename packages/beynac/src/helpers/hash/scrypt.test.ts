import { describe, expect, test } from "bun:test";
import { mock } from "../../testing/mocks.ts";
import { scrypt, scryptSync, verifyScrypt, verifyScryptSync } from "./scrypt.ts";

// Use minimal rounds for fast testing
const FAST_PARAMS = { N: 1024, r: 2, p: 2 };

describe(scrypt, () => {
	test("verifies RFC 7914 test vector 2", async () => {
		// RFC 7914 Section 12, Test Vector 2: password="password", salt="NaCl", N=1024, r=8, p=16
		// https://datatracker.ietf.org/doc/html/rfc7914#section-12
		const rfcHash =
			"$scrypt$ln=10,r=8,p=16$TmFDbA==$/bq+HJ00cgB4VucZDQHp/nxq18vII3gw53N2Y0s3MWIurzDZLiKjiG/xCSedmDDaxyevuUqD7m2DYMvfoswGQA==";

		expect(await verifyScrypt("password", rfcHash)).toBe(true);
		expect(await verifyScrypt("wrongpassword", rfcHash)).toBe(false);
	});

	test("hashing and verification work end-to-end", async () => {
		const hash = await scrypt("password123", FAST_PARAMS);

		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$.+\$.+$/);

		expect(await verifyScrypt("password123", hash)).toBe(true);

		expect(await verifyScrypt("wrongpassword", hash)).toBe(false);

		const hash2 = await scrypt("password123", FAST_PARAMS);
		expect(hash).not.toBe(hash2);
	});

	test("works with Uint8Array input", async () => {
		const password = new TextEncoder().encode("password123");
		const hash = await scrypt(password, FAST_PARAMS);

		expect(await verifyScrypt(password, hash)).toBe(true);
		expect(await verifyScrypt(new TextEncoder().encode("wrongpassword"), hash)).toBe(false);
	});
});

describe(scryptSync, () => {
	test("hashing and verification work end-to-end", () => {
		const hash = scryptSync("password123", FAST_PARAMS);

		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$.+\$.+$/);

		expect(verifyScryptSync("password123", hash)).toBe(true);

		expect(verifyScryptSync("wrongpassword", hash)).toBe(false);
	});

	test("works with Uint8Array input", () => {
		const password = new TextEncoder().encode("password123");
		const hash = scryptSync(password, FAST_PARAMS);

		expect(verifyScryptSync(password, hash)).toBe(true);
		expect(verifyScryptSync(new TextEncoder().encode("wrongpassword"), hash)).toBe(false);
	});
});

describe(verifyScrypt, () => {
	test("throws on invalid parameter type", () => {
		const invalidHash = "$scrypt$ln=invalid,r=8,p=1$c29tZXNhbHQ$c29tZWhhc2g";
		expect(verifyScrypt("password", invalidHash)).rejects.toThrow(
			"Invalid scrypt hash: ln parameter must be a number",
		);
	});
});

describe(verifyScryptSync, () => {
	test("throws on invalid parameter type", () => {
		const invalidHash = "$scrypt$ln=invalid,r=8,p=1$c29tZXNhbHQ$c29tZWhhc2g";
		expect(() => verifyScryptSync("password", invalidHash)).toThrow(
			"Invalid scrypt hash: ln parameter must be a number",
		);
	});
});

describe("mocking", () => {
	test("scrypt can be mocked", async () => {
		mock(scrypt, async () => "foo");
		const hash = await scrypt("password");
		expect(hash).toBe("foo");
	});

	test("scryptSync can be mocked", () => {
		mock(scryptSync, () => "bar");
		const hash = scryptSync("password");
		expect(hash).toBe("bar");
	});

	test("verifyScrypt can be mocked", async () => {
		mock(verifyScrypt, async () => true);
		expect(await verifyScrypt("password", "hash")).toBe(true);

		mock(verifyScrypt, async () => false);
		expect(await verifyScrypt("password", "hash")).toBe(false);
	});

	test("verifyScryptSync can be mocked", () => {
		mock(verifyScryptSync, () => true);
		expect(verifyScryptSync("password", "hash")).toBe(true);

		mock(verifyScryptSync, () => false);
		expect(verifyScryptSync("password", "hash")).toBe(false);
	});
});
