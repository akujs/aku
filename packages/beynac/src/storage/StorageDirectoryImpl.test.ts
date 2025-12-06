import { beforeEach, describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { DispatcherImpl } from "../core/DispatcherImpl.ts";
import { expectError } from "../test-utils/error.bun.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
import { mockCurrentTime } from "../testing/mock-time.ts";
import { MemoryEndpoint } from "./adapters/memory/MemoryEndpoint.ts";
import type { StorageDirectory, StorageEndpoint } from "./contracts/Storage.ts";
import { mockPlatformPaths } from "./path-operations.ts";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl.ts";
import { StorageDiskImpl } from "./StorageDiskImpl.ts";
import { StorageFileImpl } from "./StorageFileImpl.ts";
import { InvalidPathError } from "./storage-errors.ts";
import {
	DirectoryDeletedEvent,
	DirectoryDeletingEvent,
	DirectoryExistenceCheckedEvent,
	DirectoryExistenceCheckingEvent,
	DirectoryListedEvent,
	DirectoryListingEvent,
	FileWritingEvent,
	FileWrittenEvent,
} from "./storage-events.ts";

function getPaths(items: Array<{ path: string }>): string[] {
	return items.map((item) => item.path);
}

describe(StorageDirectoryImpl, () => {
	let endpoint: StorageEndpoint;
	let disk: StorageDiskImpl;
	let dispatcher: Dispatcher;

	beforeEach(() => {
		mockPlatformPaths("posix");
		endpoint = new MemoryEndpoint({
			initialFiles: {
				"/subdir/file1.txt": "file 1",
				"/subdir/file2.txt": "file 2",
				"/subdir/a/file.txt": "a file",
				"/subdir/b/file.txt": "b file",
				"/subdir/a/nested.txt": "nested",
				"/subdir/a/b/deep.txt": "deep",
			},
		});
		dispatcher = new DispatcherImpl(new ContainerImpl());
		disk = new StorageDiskImpl("test", endpoint, dispatcher);
	});

	const create = (path: string, ep = endpoint): StorageDirectory => {
		return new StorageDirectoryImpl(disk, ep, path, mockDispatcher());
	};

	describe("constructor", () => {
		test("stores disk and path", () => {
			const dir = create("/path/to/dir/");
			expect(dir.disk).toBe(disk);
			expect(dir.path).toBe("/path/to/dir/");
		});

		test("throws when trailing slash is missing", () => {
			expectError(
				() => create("/path/to/dir"),
				InvalidPathError,
				(error) => {
					expect(error.path).toBe("/path/to/dir");
					expect(error.reason).toBe("directory paths must start and end with a slash");
				},
			);
		});

		test("throws when leading slash is missing", () => {
			expect(() => create("path/to/dir/")).toThrow(InvalidPathError);
		});

		test('root path "/" is valid', () => {
			const dir = create("/");
			expect(dir.path).toBe("/");
		});
	});

	describe("exists()", () => {
		test("returns true when directory contains files", async () => {
			const dir = create("/subdir/");
			const result = await dir.exists();
			expect(result).toBe(true);
		});
	});

	describe("list()", () => {
		test("returns immediate files and directories", async () => {
			const dir = create("/subdir/");
			const entries = await dir.list();
			expect(getPaths(entries)).toEqual([
				"/subdir/a/",
				"/subdir/b/",
				"/subdir/file1.txt",
				"/subdir/file2.txt",
			]);
		});
	});

	describe("listStreaming()", () => {
		test("yields immediate files and directories", async () => {
			const dir = create("/subdir/");
			const entries = await Array.fromAsync(dir.listStreaming());
			expect(getPaths(entries)).toEqual([
				"/subdir/a/",
				"/subdir/b/",
				"/subdir/file1.txt",
				"/subdir/file2.txt",
			]);
		});
	});

	describe("listFiles()", () => {
		test("returns files directly in directory when no options provided", async () => {
			const dir = create("/subdir/");
			const files = await dir.listFiles();
			expect(getPaths(files)).toEqual(["/subdir/file1.txt", "/subdir/file2.txt"]);
		});

		test("returns files directly in directory when recursive: false", async () => {
			const dir = create("/subdir/");
			const files = await dir.listFiles({ recursive: false });
			expect(getPaths(files)).toEqual(["/subdir/file1.txt", "/subdir/file2.txt"]);
		});

		test("returns all files recursively when recursive: true", async () => {
			const dir = create("/subdir/");
			const files = await dir.listFiles({ recursive: true });
			expect(getPaths(files)).toEqual([
				"/subdir/a/b/deep.txt",
				"/subdir/a/file.txt",
				"/subdir/a/nested.txt",
				"/subdir/b/file.txt",
				"/subdir/file1.txt",
				"/subdir/file2.txt",
			]);
		});
	});

	describe("listFilesStreaming()", () => {
		test("yields files directly in directory when no options provided", async () => {
			const dir = create("/subdir/");
			const files = await Array.fromAsync(dir.listFilesStreaming());
			expect(getPaths(files)).toEqual(["/subdir/file1.txt", "/subdir/file2.txt"]);
		});

		test("yields all files recursively when recursive: true", async () => {
			const dir = create("/subdir/");
			const files = [];
			for await (const file of dir.listFilesStreaming({ recursive: true })) {
				files.push(file);
			}
			expect(getPaths(files)).toEqual([
				"/subdir/a/b/deep.txt",
				"/subdir/a/file.txt",
				"/subdir/a/nested.txt",
				"/subdir/b/file.txt",
				"/subdir/file1.txt",
				"/subdir/file2.txt",
			]);
		});
	});

	describe("listDirectories()", () => {
		test("returns direct subdirectories", async () => {
			const dir = create("/subdir/");
			expect(getPaths(await dir.listDirectories())).toEqual(["/subdir/a/", "/subdir/b/"]);
		});
	});

	describe("listDirectoriesStreaming()", () => {
		test("yields direct subdirectories", async () => {
			const dir = create("/subdir/");
			const directories = await Array.fromAsync(dir.listDirectoriesStreaming());
			expect(getPaths(directories)).toEqual(["/subdir/a/", "/subdir/b/"]);
		});
	});

	describe("deleteAll()", () => {
		test("deletes all files under prefix", async () => {
			const dir = create("/subdir/");
			await dir.deleteAll();
			expect(await dir.exists()).toBe(false);
		});
	});

	describe("directory()", () => {
		test("creates nested directory with joined path", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("child");
			expect(subdir.path).toBe("/parent/child/");
		});

		test("removes leading slash from child path", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("/child");
			expect(subdir.path).toBe("/parent/child/");
		});

		test("adds trailing slash if missing", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("child");
			expect(subdir.path).toEndWith("/");
		});

		test("creates nested directories from slash-separated path", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("a/b/c");
			expect(subdir.path).toBe("/parent/a/b/c/");
		});

		test("from root directory creates correct path with leading slash", () => {
			const root = create("/");
			const dir = root.directory("subdir");
			expect(dir.path).toBe("/subdir/");
		});

		test('returns same directory when passed "" or "/"', () => {
			const dir = create("/parent/");
			expect(dir.directory("").path).toBe(dir.path);
			expect(dir.directory("/").path).toBe(dir.path);
		});

		test("sanitises each path segment individually", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "<>",
			});
			const dir = create("/parent/", sanitisingEndpoint);
			const subdir = dir.directory("a<<b/c>>d");
			expect(subdir.path).toBe("/parent/a_b-1821dbf7/c_d-b01a45d3/");
		});

		test("converts when onInvalid is 'convert' or not provided", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "<>",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			// Default behavior (no options)
			const subdir1 = dir.directory("a<<b");
			expect(subdir1.path).toBe("/parent/a_b-1821dbf7/");

			// Explicit convert
			const subdir2 = dir.directory("a<<b", { onInvalid: "convert" });
			expect(subdir2.path).toBe("/parent/a_b-1821dbf7/");
		});

		test("throws when onInvalid is 'throw' and path has invalid chars", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "<>",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			expect(() => dir.directory("a<<b", { onInvalid: "throw" })).toThrow(InvalidPathError);

			expectError(
				() => dir.directory("a<<b", { onInvalid: "throw" }),
				InvalidPathError,
				(error) => {
					expect(error.path).toBe("/parent/a<<b");
					expect(error.reason).toBe("memory adapter does not allow <> in names");
				},
			);
		});

		describe("path normalization", () => {
			test("removes '.' segments from paths", () => {
				const dir = create("/parent/");
				expect(dir.directory("./child").path).toBe("/parent/child/");
				expect(dir.directory("a/./b").path).toBe("/parent/a/b/");
				expect(dir.directory("./a/./b/./c").path).toBe("/parent/a/b/c/");
			});

			test("processes '..' segments to go up directories", () => {
				const dir = create("/parent/child/");
				expect(dir.directory("..").path).toBe("/parent/");
				expect(dir.directory("../sibling").path).toBe("/parent/sibling/");
			});

			test("allows multiple '..' within bounds", () => {
				const dir = create("/a/b/c/d/");
				expect(dir.directory("../..").path).toBe("/a/b/");
				expect(dir.directory("../../other").path).toBe("/a/b/other/");
			});

			test("normalizes complex paths", () => {
				const dir = create("/parent/");
				expect(dir.directory("a/b/../c/./d").path).toBe("/parent/a/c/d/");
				expect(dir.directory("./a/../b").path).toBe("/parent/b/");
			});

			test("handles windows-style paths", () => {
				const dir = create("/parent/");
				expect(dir.directory("\\foo\\bar").path).toBe("/parent/foo/bar/");
				expect(dir.directory("\\foo\\bar\\").path).toBe("/parent/foo/bar/");
				expect(dir.directory("foo\\bar").path).toBe("/parent/foo/bar/");
				expect(dir.directory("foo\\bar\\").path).toBe("/parent/foo/bar/");
				expect(dir.file("\\foo\\bar").path).toBe("/parent/foo/bar");
				expect(dir.file("foo\\bar").path).toBe("/parent/foo/bar");
			});

			test("stops at root with excessive '..'", () => {
				const dir = create("/parent/child/");
				// Trying to go above root just results in root
				expect(dir.directory("../../..").path).toBe("/");
				expect(dir.directory("../../../..").path).toBe("/");
				expect(dir.directory("../../../../../../../../..").path).toBe("/");
			});

			test("stops at root when already at root", () => {
				const root = create("/");
				// From root, any amount of .. just stays at root
				expect(root.directory("..").path).toBe("/");
				expect(root.directory("../..").path).toBe("/");
			});

			test("handles complex paths with excessive traversal", () => {
				const dir = create("/a/b/");

				// These all result in root
				expect(dir.directory("c/../../..").path).toBe("/");
				expect(dir.directory("c/../../../..").path).toBe("/");
				expect(dir.directory("c/../../../../../../../../..").path).toBe("/");
			});

			test("all '..' segments normalize to root or ancestor", () => {
				const dir = create("/a/b/c/");

				expect(dir.directory("..").path).toBe("/a/b/");
				expect(dir.directory("../..").path).toBe("/a/");
				expect(dir.directory("../../..").path).toBe("/");
				expect(dir.directory("../../../..").path).toBe("/"); // Excess stops at /
			});
		});
	});

	describe("file()", () => {
		test("creates file with joined path", () => {
			const dir = create("/parent/");
			const file = dir.file("test.txt");
			expect(file.path).toBe("/parent/test.txt");
			expect(file).toBeInstanceOf(StorageFileImpl);
		});

		test("removes leading slash from file path", () => {
			const dir = create("/parent/");
			const file = dir.file("/test.txt");
			expect(file.path).toBe("/parent/test.txt");
		});

		test("converts spaces to underscores", () => {
			const dir = create("/parent/");
			const file = dir.directory(" foo\fbar ").file("  test \t.txt ");
			expect(file.path).toBe("/parent/foo_bar/test__.txt");
		});

		test("throws when filename is empty", () => {
			const dir = create("/parent/");
			expectError(
				() => dir.file(""),
				InvalidPathError,
				(error) => {
					expect(error.path).toBe("");
					expect(error.reason).toBe("file name cannot be empty");
				},
			);
			expectError(
				() => dir.file("subdir/"),
				InvalidPathError,
				(error) => {
					expect(error.path).toBe("subdir/");
					expect(error.reason).toBe("file name cannot be empty");
				},
			);
			expectError(
				() => dir.file("subdir\\"),
				InvalidPathError,
				(error) => {
					expect(error.path).toBe("subdir\\");
					expect(error.reason).toBe("file name cannot be empty");
				},
			);
		});

		test("from root directory creates correct path with leading slash", () => {
			const root = create("/");
			const file = root.file("test.txt");
			expect(file.path).toBe("/test.txt");
		});

		test("sanitises invalid characters in filename", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "<>:",
			});
			const dir = create("/parent/", sanitisingEndpoint);
			const file = dir.file("my<<file>>:test.txt");
			expect(file.path).toBe("/parent/my_file_test-cdcb6c02.txt");
		});

		test("converts when onInvalid is 'convert' or not provided", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "<>:",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			// Default behavior (no options)
			const file1 = dir.file("my<<file>>:test.txt");
			expect(file1.path).toBe("/parent/my_file_test-cdcb6c02.txt");

			// Explicit convert
			const file2 = dir.file("my<<file>>:test.txt", { onInvalid: "convert" });
			expect(file2.path).toBe("/parent/my_file_test-cdcb6c02.txt");
		});

		test("throws when onInvalid is 'throw' and filename has invalid chars", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "<>:",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			expect(() => dir.file("my<<file>>:test.txt", { onInvalid: "throw" })).toThrow(
				InvalidPathError,
			);
		});

		test("sanitises slashes in filename preserving path structure", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "/",
			});
			const dir = create("/parent/", sanitisingEndpoint);
			const file = dir.file("a/b/c");
			expect(file.path).toBe("/parent/a/b/c");
		});

		describe("path normalization", () => {
			test("removes '.' segments from file paths", () => {
				const dir = create("/parent/");
				expect(dir.file("./file.txt").path).toBe("/parent/file.txt");
				expect(dir.file("subdir/./file.txt").path).toBe("/parent/subdir/file.txt");
			});

			test("processes '..' segments in file paths", () => {
				const dir = create("/parent/child/");
				expect(dir.file("../file.txt").path).toBe("/parent/file.txt");
				expect(dir.file("../sibling/file.txt").path).toBe("/parent/sibling/file.txt");
			});

			test("normalizes complex file paths", () => {
				const dir = create("/parent/");
				expect(dir.file("a/b/../c/./file.txt").path).toBe("/parent/a/c/file.txt");
			});

			test("stops at root with excessive '..' like Unix (no errors)", () => {
				const dir = create("/parent/");
				// Excessive .. just results in file at root
				expect(dir.file("../../file.txt").path).toBe("/file.txt");
				expect(dir.file("../../../file.txt").path).toBe("/file.txt");
			});

			test("file at root with excessive '..'", () => {
				const root = create("/");
				// From root, .. just stays at root
				expect(root.file("../file.txt").path).toBe("/file.txt");
				expect(root.file("../../file.txt").path).toBe("/file.txt");
			});
		});
	});

	describe("putFile()", () => {
		test("creates file from File object and extracts name and mime type", async () => {
			const dir = create("/uploads/");
			const fileObj = new File(["content"], "document", {
				type: "text/html; charset=utf-8",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/document");
			expect(await file.exists()).toBe(true);
			const { response, originalMimeType } = await file.get();
			expect(await response.text()).toBe("content");
			expect(originalMimeType).toBe("text/html; charset=utf-8");
		});

		test("creates file from Request object and extracts metadata from headers", async () => {
			const dir = create("/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/html",
					"X-File-Name": "request-file",
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/request-file");
			const { response, originalMimeType } = await file.get();
			expect(await response.text()).toBe("content");
			expect(originalMimeType).toBe("text/html");
		});

		test("trims whitespace from File object name", async () => {
			const dir = create("/uploads/");
			const fileObj = new File(["content"], "  document.txt  ", {
				type: "text/plain",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/document.txt");
		});

		test("trims whitespace from Request X-File-Name header", async () => {
			const dir = create("/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"X-File-Name": "  request-file.txt  ",
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/request-file.txt");
		});

		test("takes basename when File name contains slashes", async () => {
			const dir = create("/uploads/");
			const fileObj = new File(["content"], "../../etc/passwd", {
				type: "text/plain",
			});
			const file = await dir.putFile(fileObj);

			expect(file.path).toBe("/uploads/passwd");
		});

		test("takes basename when Request X-File-Name contains slashes", async () => {
			const dir = create("/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"X-File-Name": "/var/www/evil.php",
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/evil.php");
		});

		test("uses Content-Disposition filename when X-File-Name is not present", async () => {
			const dir = create("/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"Content-Disposition": 'attachment; filename="download.txt"',
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/download.txt");
		});

		test("trims whitespace from Content-Disposition filename", async () => {
			const dir = create("/uploads/");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "content",
				headers: {
					"Content-Type": "text/plain",
					"Content-Disposition": 'attachment; filename="  download.txt  "',
				},
			});
			const file = await dir.putFile(request);

			expect(file.path).toBe("/uploads/download.txt");
		});

		test("generates random filename when no suggestedName provided", async () => {
			const dir = create("/uploads/");
			const file = await dir.putFile({
				data: "content",
				mimeType: "text/plain",
			});

			expect(file.path).toStartWith("/uploads/");
			expect(file.path.length).toBeGreaterThan("/uploads/".length);
		});

		test("uses suggestedName from payload when provided", async () => {
			const dir = create("/uploads/");
			const file = await dir.putFile({
				data: "content",
				mimeType: "text/plain",
				suggestedName: "custom.txt",
			});

			expect(file.path).toBe("/uploads/custom.txt");
		});
	});

	describe("toString()", () => {
		test("returns [StorageDirectoryImpl endpoint://path]", () => {
			const endpoint = new MemoryEndpoint({});
			const dir = create("/path/to/dir/", endpoint);
			expect(dir.toString()).toBe("[StorageDirectoryImpl memory://path/to/dir/]");
		});
	});

	describe("events", () => {
		let eventDisk: StorageDiskImpl;
		let eventDispatcher: ReturnType<typeof mockDispatcher>;

		beforeEach(() => {
			mockCurrentTime();
			eventDispatcher = mockDispatcher();
			eventDisk = new StorageDiskImpl("event-test", endpoint, eventDispatcher);
		});

		test("exists() dispatches directory:existence-check events once", async () => {
			const dir = eventDisk.directory("subdir");

			const exists = await dir.exists();

			const startEvent = new DirectoryExistenceCheckingEvent(eventDisk, "/subdir/");
			const endEvent = new DirectoryExistenceCheckedEvent(startEvent, exists);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("list() dispatches directory:list events via listStreaming()", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.list();

			const startEvent = new DirectoryListingEvent(eventDisk, "/subdir/", "all", false);
			const endEvent = new DirectoryListedEvent(startEvent, 4); // 2 dirs + 2 files
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listStreaming() dispatches directory:list events once", async () => {
			const dir = eventDisk.directory("subdir");

			for await (const _entry of dir.listStreaming()) {
				// Consume the generator
			}

			const startEvent = new DirectoryListingEvent(eventDisk, "/subdir/", "all", false);
			const endEvent = new DirectoryListedEvent(startEvent, 4); // 2 dirs + 2 files
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listFiles() dispatches directory:list events via listFilesStreaming() with recursive:false", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.listFiles();

			const startEvent = new DirectoryListingEvent(eventDisk, "/subdir/", "files", false);
			const endEvent = new DirectoryListedEvent(startEvent, 2); // 2 immediate files
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listFiles({recursive:true}) dispatches directory:list events via listFilesStreaming() with recursive:true", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.listFiles({ recursive: true });

			const startEvent = new DirectoryListingEvent(eventDisk, "/subdir/", "files", true);
			const endEvent = new DirectoryListedEvent(startEvent, 6); // All 6 files recursively
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listFilesStreaming() dispatches same events as listFiles()", async () => {
			const dir = eventDisk.directory("subdir");

			for await (const _file of dir.listFilesStreaming({ recursive: true })) {
				// Consume the generator
			}

			const startEvent = new DirectoryListingEvent(eventDisk, "/subdir/", "files", true);
			const endEvent = new DirectoryListedEvent(startEvent, 6);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listDirectories() dispatches directory:list events via listDirectoriesStreaming()", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.listDirectories();

			const startEvent = new DirectoryListingEvent(eventDisk, "/subdir/", "directories", false);
			const endEvent = new DirectoryListedEvent(startEvent, 2); // 2 immediate directories
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listDirectoriesStreaming() dispatches directory:list events once", async () => {
			const dir = eventDisk.directory("subdir");

			for await (const _dir of dir.listDirectoriesStreaming()) {
				// Consume the generator
			}

			const startEvent = new DirectoryListingEvent(eventDisk, "/subdir/", "directories", false);
			const endEvent = new DirectoryListedEvent(startEvent, 2); // 2 immediate directories
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("deleteAll() dispatches directory:delete events once", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.deleteAll();

			const startEvent = new DirectoryDeletingEvent(eventDisk, "/subdir/");
			const endEvent = new DirectoryDeletedEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("putFile() dispatches file:write events only", async () => {
			const dir = eventDisk.directory("uploads");

			const data = "content";
			await dir.putFile({ data, mimeType: "text/plain", suggestedName: "test.txt" });

			const startEvent = new FileWritingEvent(eventDisk, "/uploads/test.txt", data, "text/plain");
			const endEvent = new FileWrittenEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});
	});
});
