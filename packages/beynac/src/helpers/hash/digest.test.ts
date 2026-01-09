import { describe, expect, test } from "bun:test";
import { mock } from "../../testing/mocks.ts";
import { md5, sha3_256, sha3_512, sha256, sha512 } from "./digest.ts";

describe(md5, () => {
	test("hashes string input", () => {
		const hash = md5("test");
		expect(hash).toBe("098f6bcd4621d373cade4e832627b4f6");
	});

	test("hashes Uint8Array input", () => {
		const data = new TextEncoder().encode("test");
		const hash = md5(data);
		expect(hash).toBe("098f6bcd4621d373cade4e832627b4f6");
	});

	test("produces consistent hashes for same input", () => {
		const hash1 = md5("test");
		const hash2 = md5("test");
		expect(hash1).toBe(hash2);
	});

	test("handles empty string", () => {
		const hash = md5("");
		expect(hash).toBe("d41d8cd98f00b204e9800998ecf8427e");
	});
});

describe(sha256, () => {
	test("hashes string input", () => {
		const hash = sha256("test");
		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
	});

	test("hashes Uint8Array input", () => {
		const data = new TextEncoder().encode("test");
		const hash = sha256(data);
		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
	});

	test("produces consistent hashes for same input", () => {
		const hash1 = sha256("test");
		const hash2 = sha256("test");
		expect(hash1).toBe(hash2);
	});

	test("handles empty string", () => {
		const hash = sha256("");
		expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
});

describe(sha512, () => {
	test("hashes with known test vector", () => {
		const hash = sha512("test");
		expect(hash).toBe(
			"ee26b0dd4af7e749aa1a8ee3c10ae9923f618980772e473f8819a5d4940e0db27ac185f8a0e1d5f84f88bc887fd67b143732c304cc5fa9ad8e6f57f50028a8ff",
		);
	});
});

describe(sha3_256, () => {
	test("hashes with known test vector", () => {
		const hash = sha3_256("test");
		expect(hash).toBe("36f028580bb02cc8272a9a020f4200e346e276ae664e45ee80745574e2f5ab80");
	});
});

describe(sha3_512, () => {
	test("hashes with known test vector", () => {
		const hash = sha3_512("test");
		expect(hash).toBe(
			"9ece086e9bac491fac5c1d1046ca11d737b92a2b2ebd93f005d7b710110c0a678288166e7fbe796883a4f2e9b3ca9f484f521d0ce464345cc1aec96779149c14",
		);
	});
});

describe("mocking", () => {
	test("digest functions can be mocked", () => {
		mock(md5, () => "mocked-md5");
		mock(sha256, () => "mocked-sha256");
		mock(sha512, () => "mocked-sha512");
		mock(sha3_256, () => "mocked-sha3_256");
		mock(sha3_512, () => "mocked-sha3_512");
		mock(sha3_512, () => "mocked-sha3_512");

		expect(md5("foo")).toBe("mocked-md5");
		expect(sha256("foo")).toBe("mocked-sha256");
		expect(sha512("foo")).toBe("mocked-sha512");
		expect(sha3_256("foo")).toBe("mocked-sha3_256");
		expect(sha3_512("foo")).toBe("mocked-sha3_512");
		expect(sha3_512("foo")).toBe("mocked-sha3_512");
	});
});
