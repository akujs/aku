import { describe, expect, test } from "bun:test";
import { mock } from "../../testing/mocks.ts";
import { hashMd5, hashSha3_256, hashSha3_512, hashSha256, hashSha512 } from "./digest.ts";

describe(hashMd5, () => {
	test("hashes string input", () => {
		const hash = hashMd5("test");
		expect(hash).toBe("098f6bcd4621d373cade4e832627b4f6");
	});

	test("hashes Uint8Array input", () => {
		const data = new TextEncoder().encode("test");
		const hash = hashMd5(data);
		expect(hash).toBe("098f6bcd4621d373cade4e832627b4f6");
	});

	test("produces consistent hashes for same input", () => {
		const hash1 = hashMd5("test");
		const hash2 = hashMd5("test");
		expect(hash1).toBe(hash2);
	});

	test("handles empty string", () => {
		const hash = hashMd5("");
		expect(hash).toBe("d41d8cd98f00b204e9800998ecf8427e");
	});
});

describe(hashSha256, () => {
	test("hashes string input", () => {
		const hash = hashSha256("test");
		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
	});

	test("hashes Uint8Array input", () => {
		const data = new TextEncoder().encode("test");
		const hash = hashSha256(data);
		expect(hash).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
	});

	test("produces consistent hashes for same input", () => {
		const hash1 = hashSha256("test");
		const hash2 = hashSha256("test");
		expect(hash1).toBe(hash2);
	});

	test("handles empty string", () => {
		const hash = hashSha256("");
		expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});
});

describe(hashSha512, () => {
	test("hashes with known test vector", () => {
		const hash = hashSha512("test");
		expect(hash).toBe(
			"ee26b0dd4af7e749aa1a8ee3c10ae9923f618980772e473f8819a5d4940e0db27ac185f8a0e1d5f84f88bc887fd67b143732c304cc5fa9ad8e6f57f50028a8ff",
		);
	});
});

describe(hashSha3_256, () => {
	test("hashes with known test vector", () => {
		const hash = hashSha3_256("test");
		expect(hash).toBe("36f028580bb02cc8272a9a020f4200e346e276ae664e45ee80745574e2f5ab80");
	});
});

describe(hashSha3_512, () => {
	test("hashes with known test vector", () => {
		const hash = hashSha3_512("test");
		expect(hash).toBe(
			"9ece086e9bac491fac5c1d1046ca11d737b92a2b2ebd93f005d7b710110c0a678288166e7fbe796883a4f2e9b3ca9f484f521d0ce464345cc1aec96779149c14",
		);
	});
});

describe("mocking", () => {
	test("digest functions can be mocked", () => {
		mock(hashMd5, () => "mocked-hashMd5");
		mock(hashSha256, () => "mocked-hashSha256");
		mock(hashSha512, () => "mocked-hashSha512");
		mock(hashSha3_256, () => "mocked-hashSha3_256");
		mock(hashSha3_512, () => "mocked-hashSha3_512");
		mock(hashSha3_512, () => "mocked-hashSha3_512");

		expect(hashMd5("foo")).toBe("mocked-hashMd5");
		expect(hashSha256("foo")).toBe("mocked-hashSha256");
		expect(hashSha512("foo")).toBe("mocked-hashSha512");
		expect(hashSha3_256("foo")).toBe("mocked-hashSha3_256");
		expect(hashSha3_512("foo")).toBe("mocked-hashSha3_512");
		expect(hashSha3_512("foo")).toBe("mocked-hashSha3_512");
	});
});
