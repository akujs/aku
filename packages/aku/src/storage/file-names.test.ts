import { describe, expect, test } from "bun:test";
import { sha256 } from "../helpers/hash/digest.ts";
import * as str from "../helpers/str/random.ts";
import { mock } from "../testing/mocks.ts";
import { createFileName, mimeTypeFromFileName, sanitiseName } from "./file-names.ts";

describe(mimeTypeFromFileName, () => {
	test("returns correct MIME type for extensions", () => {
		expect(mimeTypeFromFileName("file.png")).toBe("image/png");
		expect(mimeTypeFromFileName("file.jpg")).toBe("image/jpeg");
		expect(mimeTypeFromFileName("file.css")).toBe("text/css");
		expect(mimeTypeFromFileName("file.json")).toBe("application/json");
	});

	test("is case insensitive", () => {
		expect(mimeTypeFromFileName("file.PNG")).toBe("image/png");
		expect(mimeTypeFromFileName("file.PDF")).toBe("application/pdf");
		expect(mimeTypeFromFileName("FILE.HTML")).toBe("text/html");
	});

	test("returns null for unknown or no extensions", () => {
		expect(mimeTypeFromFileName("file.xyz")).toBeNull();
		expect(mimeTypeFromFileName("file.unknown")).toBeNull();
		expect(mimeTypeFromFileName("README")).toBeNull();
		expect(mimeTypeFromFileName("Makefile")).toBeNull();
	});

	test("extracts extension from full path", () => {
		expect(mimeTypeFromFileName("path/to/file.png")).toBe("image/png");
		expect(mimeTypeFromFileName("/absolute/path/document.pdf")).toBe("application/pdf");
	});

	test("handles multiple dots in filename", () => {
		expect(mimeTypeFromFileName("archive.tar.gz")).toBe("application/x-gzip");
		expect(mimeTypeFromFileName("component.test.js")).toBe("text/javascript");
	});
});

describe(createFileName, () => {
	test("when supportsMimeTypes=true, preserves name unchanged", () => {
		expect(createFileName("test.txt", "image/png", true)).toBe("test.txt");
	});

	test("when supportsMimeTypes=false and extension is correct, leaves file name unchanged", () => {
		expect(createFileName("test.png", "image/png", false)).toBe("test.png");
		expect(createFileName("test.PNG", "image/png", false)).toBe("test.PNG");
	});

	test("when supportsMimeTypes=false and extension is incorrect, appends correct extension", () => {
		expect(createFileName("test.txt", "image/png", false)).toBe("test.txt.png");
		expect(createFileName("test.TXT", "image/png", false)).toBe("test.TXT.png");
		expect(createFileName("test", "image/png", false)).toBe("test.png");
	});

	test("when MIME type not in known list, doesn't append extension", () => {
		expect(createFileName("test.custom", "application/x-unknown", false)).toBe("test.custom");
	});

	test("preserves valid special chars", () => {
		expect(createFileName("test-file~v2.txt", "text/plain", true)).toBe("test-file~v2.txt");
	});

	test("generates random ID when suggestedName is not provided", () => {
		mock(str.random, () => "ABCD1234EFGH5678IJKL");
		expect(createFileName(null, "text/plain", true)).toBe("ABCD1234EFGH5678IJKL.txt");
		expect(createFileName(undefined, "text/plain", true)).toBe("ABCD1234EFGH5678IJKL.txt");
		expect(createFileName("", "text/plain", true)).toBe("ABCD1234EFGH5678IJKL.txt");
	});

	test("random IDs are different each time", () => {
		const id1 = createFileName(null, "text/plain", true);
		const id2 = createFileName(null, "text/plain", true);
		expect(id1).not.toBe(id2);
	});

	test("handles MIME types with parameters", () => {
		expect(createFileName("test.html", "text/html; charset=utf-8", false)).toBe("test.html");
		expect(createFileName("test", "text/html; charset=utf-8", false)).toBe("test.html");
		expect(createFileName("test.txt", "text/html; charset=utf-8", false)).toBe("test.txt.html");
	});
});

describe(sanitiseName, () => {
	test("returns name unchanged when no invalid chars", () => {
		expect(sanitiseName("test.txt", "")).toBe("test.txt");
		expect(sanitiseName("my-file_123.pdf", "")).toBe("my-file_123.pdf");
	});

	test("replaces invalid characters with underscore and adds hash", () => {
		mock(sha256, () => "abcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab");
		expect(sanitiseName("my<file>.txt", "<>")).toBe("my_file_-abcd1234.txt");
		expect(sanitiseName("test:file", ":")).toBe("test_file-abcd1234");
		expect(sanitiseName("a/b/c", "/")).toBe("a_b_c-abcd1234");
	});

	test("filenames that only differ by invalid characters preserve uniqueness", () => {
		expect(sanitiseName("my<file.txt", "<>")).toBe("my_file-bd7c6d5c.txt");
		expect(sanitiseName("my>file.txt", "<>")).toBe("my_file-155ab680.txt");
	});

	test("replaces multiple invalid characters collapsing consecutive to single underscore", () => {
		mock(sha256, () => "1234abcd567890abcdef1234567890abcdef1234567890abcdef1234567890ab");
		expect(sanitiseName("my<file>:test.txt", "<>:")).toBe("my_file_test-1234abcd.txt");
		expect(sanitiseName("<<>>>", "<>")).toBe("_-1234abcd");
	});

	test("handles special regex characters in invalidChars", () => {
		mock(sha256, () => "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210");
		expect(sanitiseName("test[file].txt", "[]")).toBe("test_file_-fedcba98.txt");
		expect(sanitiseName("test\\file", "\\")).toBe("test_file-fedcba98");
		expect(sanitiseName("test^file", "^")).toBe("test_file-fedcba98");
		expect(sanitiseName("test-file", "-")).toBe("test_file-fedcba98");
	});

	test("handles Windows invalid chars collapsing consecutive", () => {
		mock(sha256, () => "9999aaaa8888bbbb7777cccc6666dddd5555eeee4444ffff3333aaaa2222bbbb");
		const windowsInvalid = '<>:"/\\|?*';
		expect(sanitiseName('my<file>:"test".txt', windowsInvalid)).toBe("my_file_test_-9999aaaa.txt");
	});

	test("works on single names (no path handling)", () => {
		// Slashes are treated as invalid chars if specified
		expect(sanitiseName("file.txt", "/")).toBe("file.txt");
		mock(sha256, () => "5555cccc4444dddd3333eeee2222ffff1111aaaa0000bbbb9999cccc8888dddd");
		expect(sanitiseName("path/to/file.txt", "/")).toBe("path_to_file-5555cccc.txt");
	});
});
