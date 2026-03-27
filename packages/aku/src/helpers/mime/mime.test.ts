import { describe, expect, test } from "bun:test";
import { mimeGetExtensionForType, mimeGetTypeForExtension } from "./mime.ts";

describe(mimeGetTypeForExtension, () => {
	test("returns correct MIME type for dotted extensions", () => {
		expect(mimeGetTypeForExtension(".png")).toBe("image/png");
		expect(mimeGetTypeForExtension(".jpg")).toBe("image/jpeg");
		expect(mimeGetTypeForExtension(".css")).toBe("text/css");
		expect(mimeGetTypeForExtension(".json")).toBe("application/json");
	});

	test("returns correct MIME type for bare extensions (no dot)", () => {
		expect(mimeGetTypeForExtension("png")).toBe("image/png");
		expect(mimeGetTypeForExtension("pdf")).toBe("application/pdf");
		expect(mimeGetTypeForExtension("html")).toBe("text/html");
	});

	test("returns correct MIME type for filenames", () => {
		expect(mimeGetTypeForExtension("file.png")).toBe("image/png");
		expect(mimeGetTypeForExtension("document.pdf")).toBe("application/pdf");
	});

	test("returns correct MIME type for full paths", () => {
		expect(mimeGetTypeForExtension("path/to/file.png")).toBe("image/png");
		expect(mimeGetTypeForExtension("/absolute/path/document.pdf")).toBe("application/pdf");
	});

	test("is case insensitive", () => {
		expect(mimeGetTypeForExtension("file.PNG")).toBe("image/png");
		expect(mimeGetTypeForExtension("file.PDF")).toBe("application/pdf");
		expect(mimeGetTypeForExtension("FILE.HTML")).toBe("text/html");
		expect(mimeGetTypeForExtension(".PDF")).toBe("application/pdf");
		expect(mimeGetTypeForExtension("PDF")).toBe("application/pdf");
	});

	test("returns null for unknown or no extensions", () => {
		expect(mimeGetTypeForExtension("file.xyz")).toBeNull();
		expect(mimeGetTypeForExtension("file.unknown")).toBeNull();
		expect(mimeGetTypeForExtension("README")).toBeNull();
		expect(mimeGetTypeForExtension("Makefile")).toBeNull();
	});

	test("handles multiple dots in filename", () => {
		expect(mimeGetTypeForExtension("archive.tar.gz")).toBe("application/x-gzip");
		expect(mimeGetTypeForExtension("component.test.js")).toBe("text/javascript");
	});
});

describe(mimeGetExtensionForType, () => {
	test("returns canonical extension for known MIME types", () => {
		expect(mimeGetExtensionForType("application/pdf")).toBe(".pdf");
		expect(mimeGetExtensionForType("image/png")).toBe(".png");
		expect(mimeGetExtensionForType("text/html")).toBe(".html");
		expect(mimeGetExtensionForType("image/jpeg")).toBe(".jpeg");
	});

	test("returns null for unknown MIME types", () => {
		expect(mimeGetExtensionForType("application/x-unknown")).toBeNull();
		expect(mimeGetExtensionForType("fake/type")).toBeNull();
	});
});
