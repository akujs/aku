import { describe, expect, test } from "bun:test";
import { mock } from "../../testing/mocks.ts";
import { hashScrypt, hashScryptSync, hashVerifyScrypt, hashVerifyScryptSync } from "./scrypt.ts";

// Use minimal rounds for fast testing
const FAST_PARAMS = { N: 1024, r: 2, p: 2 };

describe(hashScrypt, () => {
	test("verifies RFC 7914 test vector 2", async () => {
		// RFC 7914 Section 12, Test Vector 2: password="password", salt="NaCl", N=1024, r=8, p=16
		// https://datatracker.ietf.org/doc/html/rfc7914#section-12
		const rfcHash =
			"$scrypt$ln=10,r=8,p=16$TmFDbA==$/bq+HJ00cgB4VucZDQHp/nxq18vII3gw53N2Y0s3MWIurzDZLiKjiG/xCSedmDDaxyevuUqD7m2DYMvfoswGQA==";

		expect(await hashVerifyScrypt("password", rfcHash)).toBe(true);
		expect(await hashVerifyScrypt("wrongpassword", rfcHash)).toBe(false);
	});

	test("hashing and verification work end-to-end", async () => {
		const hash = await hashScrypt("password123", FAST_PARAMS);

		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$.+\$.+$/);

		expect(await hashVerifyScrypt("password123", hash)).toBe(true);

		expect(await hashVerifyScrypt("wrongpassword", hash)).toBe(false);

		const hash2 = await hashScrypt("password123", FAST_PARAMS);
		expect(hash).not.toBe(hash2);
	});

	test("works with Uint8Array input", async () => {
		const password = new TextEncoder().encode("password123");
		const hash = await hashScrypt(password, FAST_PARAMS);

		expect(await hashVerifyScrypt(password, hash)).toBe(true);
		expect(await hashVerifyScrypt(new TextEncoder().encode("wrongpassword"), hash)).toBe(false);
	});
});

describe(hashScryptSync, () => {
	test("hashing and verification work end-to-end", () => {
		const hash = hashScryptSync("password123", FAST_PARAMS);

		expect(hash).toMatch(/^\$scrypt\$ln=\d+,r=\d+,p=\d+\$.+\$.+$/);

		expect(hashVerifyScryptSync("password123", hash)).toBe(true);

		expect(hashVerifyScryptSync("wrongpassword", hash)).toBe(false);
	});

	test("works with Uint8Array input", () => {
		const password = new TextEncoder().encode("password123");
		const hash = hashScryptSync(password, FAST_PARAMS);

		expect(hashVerifyScryptSync(password, hash)).toBe(true);
		expect(hashVerifyScryptSync(new TextEncoder().encode("wrongpassword"), hash)).toBe(false);
	});
});

describe(hashVerifyScrypt, () => {
	test("throws on invalid parameter type", () => {
		const invalidHash = "$scrypt$ln=invalid,r=8,p=1$c29tZXNhbHQ$c29tZWhhc2g";
		expect(hashVerifyScrypt("password", invalidHash)).rejects.toThrow(
			"Invalid scrypt hash: ln parameter must be a number",
		);
	});
});

describe(hashVerifyScryptSync, () => {
	test("throws on invalid parameter type", () => {
		const invalidHash = "$scrypt$ln=invalid,r=8,p=1$c29tZXNhbHQ$c29tZWhhc2g";
		expect(() => hashVerifyScryptSync("password", invalidHash)).toThrow(
			"Invalid scrypt hash: ln parameter must be a number",
		);
	});
});

describe("mocking", () => {
	test("hashScrypt can be mocked", async () => {
		mock(hashScrypt, async () => "foo");
		const hash = await hashScrypt("password");
		expect(hash).toBe("foo");
	});

	test("hashScryptSync can be mocked", () => {
		mock(hashScryptSync, () => "bar");
		const hash = hashScryptSync("password");
		expect(hash).toBe("bar");
	});

	test("hashVerifyScrypt can be mocked", async () => {
		mock(hashVerifyScrypt, async () => true);
		expect(await hashVerifyScrypt("password", "hash")).toBe(true);

		mock(hashVerifyScrypt, async () => false);
		expect(await hashVerifyScrypt("password", "hash")).toBe(false);
	});

	test("hashVerifyScryptSync can be mocked", () => {
		mock(hashVerifyScryptSync, () => true);
		expect(hashVerifyScryptSync("password", "hash")).toBe(true);

		mock(hashVerifyScryptSync, () => false);
		expect(hashVerifyScryptSync("password", "hash")).toBe(false);
	});
});
