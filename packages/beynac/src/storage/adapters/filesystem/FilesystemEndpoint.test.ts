import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sleep } from "bun";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import type { StorageEndpoint } from "../../contracts/Storage.ts";
import { mockPlatformPaths } from "../../path-operations.ts";
import { StorageUnknownError } from "../../storage-errors.ts";
import type { SharedTestConfig } from "../../storage-test-utils.bun.ts";
import { FilesystemEndpoint } from "./FilesystemEndpoint.ts";
import { filesystemStorage } from "./filesystemStorage.ts";

beforeEach(() => {
	mockPlatformPaths("posix");
});

function filesystemStorageWithTmpDir(): StorageEndpoint {
	const tempDir = createTestDirectory();
	return new FilesystemEndpoint({
		rootPath: tempDir,
		makePublicUrlWith: "https://example.com/files",
		makeSignedDownloadUrlWith: ({ path, expires, downloadFileName }) => {
			const params = new URLSearchParams();
			params.set("expires", expires.toISOString());
			if (downloadFileName) {
				params.set("download", downloadFileName);
			}
			return `mock-url://download${path}?${params.toString()}`;
		},
		makeSignedUploadUrlWith: ({ path, expires }) => {
			const params = new URLSearchParams();
			params.set("expires", expires.toISOString());
			return `mock-url://upload${path}?${params.toString()}`;
		},
	});
}

export const filesystemStorageSharedTestConfig: SharedTestConfig = {
	name: filesystemStorage.name,
	createEndpoint: filesystemStorageWithTmpDir,
};

describe(filesystemStorage, () => {
	describe("Filesystem-specific behavior", () => {
		let tempDir: string;
		let storage: StorageEndpoint;

		const fsPath = (relativePath: string) => join(tempDir, relativePath);

		const writeTestFile = async (storage: StorageEndpoint, path: string) => {
			await storage.writeSingle({ path, data: "content", mimeType: null });
		};

		beforeEach(() => {
			tempDir = createTestDirectory();
			storage = new FilesystemEndpoint({
				rootPath: tempDir,
				makePublicUrlWith: "https://example.com/files",
				makeSignedDownloadUrlWith: ({ path, expires, downloadFileName }) => {
					const params = new URLSearchParams();
					params.set("expires", expires.toISOString());
					if (downloadFileName) {
						params.set("download", downloadFileName);
					}
					return `mock-url://download${path}?${params.toString()}`;
				},
				makeSignedUploadUrlWith: ({ path, expires }) => {
					const params = new URLSearchParams();
					params.set("expires", expires.toISOString());
					return `mock-url://upload${path}?${params.toString()}`;
				},
			});
		});

		test("makePublicUrlWith configuration - throws when not configured", async () => {
			const storageWithoutPrefix = new FilesystemEndpoint({ rootPath: tempDir });

			await writeTestFile(storageWithoutPrefix, "/test.txt");

			expect(storageWithoutPrefix.getPublicDownloadUrl("/test.txt")).rejects.toThrow(
				"makePublicUrlWith is required",
			);
			expect(
				storageWithoutPrefix.getSignedDownloadUrl("/test.txt", new Date(Date.now() + 3600000)),
			).rejects.toThrow("makeSignedDownloadUrlWith is required");
			expect(
				storageWithoutPrefix.getTemporaryUploadUrl("/test.txt", new Date(Date.now() + 3600000)),
			).rejects.toThrow("makeSignedUploadUrlWith is required");
		});

		test("makePublicUrlWith configuration - uses configured string prefix", async () => {
			await writeTestFile(storage, "/test.txt");

			const publicUrl = await storage.getPublicDownloadUrl("/test.txt");
			expect(publicUrl).toBe("https://example.com/files/test.txt");

			const publicUrlWithDownload = await storage.getPublicDownloadUrl("/test.txt", "custom.txt");
			expect(publicUrlWithDownload).toBe("https://example.com/files/test.txt?download=custom.txt");

			const signedUrl = await storage.getSignedDownloadUrl("/test.txt", new Date("2025-11-14"));
			expect(signedUrl).toStartWith("mock-url://download/test.txt?expires=2025-11-14");

			const uploadUrl = await storage.getTemporaryUploadUrl("/test.txt", new Date("2025-11-14"));
			expect(uploadUrl).toStartWith("mock-url://upload/test.txt?expires=2025-11-14");
		});

		test("makePublicUrlWith configuration - uses callback function", async () => {
			const storageWithCallback = new FilesystemEndpoint({
				rootPath: tempDir,
				makePublicUrlWith: (path) => `https://custom-cdn.example.com/v2${path}`,
			});

			await writeTestFile(storageWithCallback, "/test.txt");

			const publicUrl = await storageWithCallback.getPublicDownloadUrl("/test.txt");
			expect(publicUrl).toBe("https://custom-cdn.example.com/v2/test.txt");

			const publicUrlWithDownload = await storageWithCallback.getPublicDownloadUrl(
				"/test.txt",
				"custom.txt",
			);
			expect(publicUrlWithDownload).toBe(
				"https://custom-cdn.example.com/v2/test.txt?download=custom.txt",
			);
		});

		test("makePublicUrlWith with trailing slash", async () => {
			const storageWithTrailingSlash = new FilesystemEndpoint({
				rootPath: tempDir,
				makePublicUrlWith: "https://cdn.example.com/files/",
			});

			await writeTestFile(storageWithTrailingSlash, "/test.txt");

			const url = await storageWithTrailingSlash.getPublicDownloadUrl("/test.txt");
			expect(url).toBe("https://cdn.example.com/files/test.txt");
		});

		test("ETag changes when file is modified", async () => {
			await storage.writeSingle({ path: "/test.txt", data: "content1", mimeType: null });
			const info1 = await storage.getInfoSingle("/test.txt");

			// Wait a bit to ensure mtime changes
			await sleep(2);

			await storage.writeSingle({ path: "/test.txt", data: "content2", mimeType: null });
			const info2 = await storage.getInfoSingle("/test.txt");

			const sha256Regex = /^[a-f0-9]{64}$/;
			expect(info1?.etag).toMatch(sha256Regex);
			expect(info2?.etag).toMatch(sha256Regex);
			expect(info1?.etag).not.toBe(info2?.etag);
		});

		test("deeply nested directories are auto-created", async () => {
			await writeTestFile(storage, "/a/b/c/d/e/file.txt");

			const exists = await storage.existsSingle("/a/b/c/d/e/file.txt");
			expect(exists).toBe(true);

			// Verify actual filesystem structure
			const content = readFileSync(fsPath("a/b/c/d/e/file.txt"), "utf-8");
			expect(content).toBe("content");
		});

		test("copy creates destination directories", async () => {
			await writeTestFile(storage, "/source.txt");
			await storage.copy("/source.txt", "/deep/nested/dest.txt");

			const exists = await storage.existsSingle("/deep/nested/dest.txt");
			expect(exists).toBe(true);
		});

		test("move creates destination directories", async () => {
			await writeTestFile(storage, "/source.txt");
			await storage.move("/source.txt", "/deep/nested/dest.txt");

			const sourceExists = await storage.existsSingle("/source.txt");
			const destExists = await storage.existsSingle("/deep/nested/dest.txt");
			expect(sourceExists).toBe(false);
			expect(destExists).toBe(true);
		});

		test("reading a directory as a file produces EISDIR error from stream", async () => {
			await writeTestFile(storage, "/subdir/file.txt");

			let error: Error | null = null;
			try {
				const result = await storage.readSingle("/subdir");
				await new Response(result.data).arrayBuffer();
			} catch (e) {
				error = e as Error;
			}

			// Errors should be converted to non-node error
			expect(error).toBeInstanceOf(StorageUnknownError);
			expect(error?.toString()).toContain("EISDIR: illegal operation on a directory, read");
		});

		test("deleteAllUnderPrefix removes all files and directories including prefix", async () => {
			// Create nested directory structure with files
			await writeTestFile(storage, "/parent/file1.txt");
			await writeTestFile(storage, "/parent/subdir/file2.txt");
			await writeTestFile(storage, "/parent/subdir/deep/file3.txt");
			await writeTestFile(storage, "/other/file4.txt");

			// Verify structure exists
			expect(existsSync(fsPath("parent/file1.txt"))).toBe(true);
			expect(existsSync(fsPath("parent/subdir/file2.txt"))).toBe(true);
			expect(existsSync(fsPath("parent/subdir/deep/file3.txt"))).toBe(true);
			expect(existsSync(fsPath("other/file4.txt"))).toBe(true);

			// Delete everything under /parent/
			await storage.deleteAllUnderPrefix("/parent/");

			// Verify /parent/ directory and all contents are deleted
			expect(existsSync(fsPath("parent"))).toBe(false);
			expect(existsSync(fsPath("parent/file1.txt"))).toBe(false);
			expect(existsSync(fsPath("parent/subdir"))).toBe(false);
			expect(existsSync(fsPath("parent/subdir/file2.txt"))).toBe(false);
			expect(existsSync(fsPath("parent/subdir/deep"))).toBe(false);
			expect(existsSync(fsPath("parent/subdir/deep/file3.txt"))).toBe(false);

			// Verify /other/ directory is untouched
			expect(existsSync(fsPath("other/file4.txt"))).toBe(true);
		});

		test("deleteAllUnderPrefix succeeds when directory does not exist", async () => {
			// Should not throw
			await storage.deleteAllUnderPrefix("/nonexistent/");

			// Verify it completes without error
			expect(true).toBe(true);
		});
	});
});
