import { beforeEach, describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { DispatcherImpl } from "../core/DispatcherImpl.ts";
import { expectError } from "../test-utils/error.test-utils.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.test-utils.ts";
import { mockCurrentTime } from "../testing/mock-time.ts";
import { MemoryEndpoint } from "./adapters/memory/MemoryEndpoint.ts";
import type { StorageDirectory, StorageEndpoint } from "./contracts/Storage.ts";
import { mockPlatformPaths } from "./path-operations.ts";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl.ts";
import { StorageDiskImpl } from "./StorageDiskImpl.ts";
import { StorageFileImpl } from "./StorageFileImpl.ts";
import { StorageInvalidPathError } from "./storage-errors.ts";
import {
	StorageDirectoryDeletedEvent,
	StorageDirectoryDeletingEvent,
	StorageDirectoryExistenceCheckedEvent,
	StorageDirectoryExistenceCheckingEvent,
	StorageDirectoryListedEvent,
	StorageDirectoryListingEvent,
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
				StorageInvalidPathError,
				(error) => {
					expect(error.path).toBe("/path/to/dir");
					expect(error.reason).toBe("directory paths must start and end with a slash");
				},
			);
		});

		test("throws when leading slash is missing", () => {
			expect(() => create("path/to/dir/")).toThrow(StorageInvalidPathError);
		});

		test('root path "/" is valid', () => {
			const dir = create("/");
			expect(dir.path).toBe("/");
		});
	});

	describe("name", () => {
		test('returns last segment for "/foo/bar/"', () => {
			const dir = create("/foo/bar/");
			expect(dir.name).toBe("bar");
		});

		test('returns empty string for root "/"', () => {
			const dir = create("/");
			expect(dir.name).toBe("");
		});

		test("returns segment for single-level directory", () => {
			const dir = create("/foo/");
			expect(dir.name).toBe("foo");
		});
	});

	describe("parent", () => {
		test('returns parent directory for "/foo/bar/"', () => {
			const dir = create("/foo/bar/");
			expect(dir.parent?.path).toBe("/foo/");
		});

		test('returns null for root "/"', () => {
			const dir = create("/");
			expect(dir.parent).toBe(null);
		});

		test("returns root for single-level directory", () => {
			const dir = create("/foo/");
			expect(dir.parent?.path).toBe("/");
		});

		test("supports chaining parent.parent", () => {
			const dir = create("/a/b/c/");
			expect(dir.parent?.path).toBe("/a/b/");
			expect(dir.parent?.parent?.path).toBe("/a/");
			expect(dir.parent?.parent?.parent?.path).toBe("/");
			expect(dir.parent?.parent?.parent?.parent).toBe(null);
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

		test("adds trailing slash", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("child");
			expect(subdir.path).toEndWith("/");
		});

		test("from root directory creates correct path", () => {
			const root = create("/");
			const dir = root.directory("subdir");
			expect(dir.path).toBe("/subdir/");
		});

		test("throws when directory name is empty", () => {
			const dir = create("/parent/");
			expectError(
				() => dir.directory(""),
				StorageInvalidPathError,
				(error) => {
					expect(error.path).toBe("");
					expect(error.reason).toBe("directory name cannot be empty");
				},
			);
		});

		test("rejects slashes in directory name", () => {
			const dir = create("/parent/");
			expect(() => dir.directory("a/b")).toThrow(StorageInvalidPathError);
			expect(() => dir.directory("a\\b")).toThrow(StorageInvalidPathError);
			expect(() => dir.directory("/child")).toThrow(StorageInvalidPathError);
		});

		test("rejects '.' and '..' path traversal", () => {
			const dir = create("/parent/");
			expect(() => dir.directory(".")).toThrow(StorageInvalidPathError);
			expect(() => dir.directory("..")).toThrow(StorageInvalidPathError);
		});

		test("throws when name has invalid chars for the endpoint", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "<>",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			expectError(
				() => dir.directory("a<<b"),
				StorageInvalidPathError,
				(error) => {
					expect(error.path).toBe("/parent/a<<b");
					expect(error.reason).toBe("memory adapter does not allow <> in names");
				},
			);
		});

		test("allows whitespace if the endpoint allows it", () => {
			const dir = create("/parent/");
			const subdir = dir.directory("foo bar");
			expect(subdir.path).toBe("/parent/foo bar/");
		});
	});

	describe("file()", () => {
		test("creates file with joined path", () => {
			const dir = create("/parent/");
			const file = dir.file("test.txt");
			expect(file.path).toBe("/parent/test.txt");
			expect(file).toBeInstanceOf(StorageFileImpl);
		});

		test("throws when filename is empty", () => {
			const dir = create("/parent/");
			expectError(
				() => dir.file(""),
				StorageInvalidPathError,
				(error) => {
					expect(error.path).toBe("");
					expect(error.reason).toBe("file name cannot be empty");
				},
			);
		});

		test("from root directory creates correct path", () => {
			const root = create("/");
			const file = root.file("test.txt");
			expect(file.path).toBe("/test.txt");
		});

		test("rejects slashes in file name", () => {
			const dir = create("/parent/");
			expect(() => dir.file("a/b.txt")).toThrow(StorageInvalidPathError);
			expect(() => dir.file("a\\b.txt")).toThrow(StorageInvalidPathError);
			expect(() => dir.file("/test.txt")).toThrow(StorageInvalidPathError);
			expect(() => dir.file("subdir/")).toThrow(StorageInvalidPathError);
			expect(() => dir.file("subdir\\")).toThrow(StorageInvalidPathError);
		});

		test("rejects '.' and '..' path traversal", () => {
			const dir = create("/parent/");
			expect(() => dir.file(".")).toThrow(StorageInvalidPathError);
			expect(() => dir.file("..")).toThrow(StorageInvalidPathError);
		});

		test("throws when name has invalid chars for the endpoint", () => {
			const sanitisingEndpoint = new MemoryEndpoint({
				invalidNameChars: "<>:",
			});
			const dir = create("/parent/", sanitisingEndpoint);

			expectError(
				() => dir.file("my<<file>>:test.txt"),
				StorageInvalidPathError,
				(error) => {
					expect(error.path).toBe("/parent/my<<file>>:test.txt");
				},
			);
		});

		test("allows whitespace if the endpoint allows it", () => {
			const dir = create("/parent/");
			const file = dir.file("foo bar.txt");
			expect(file.path).toBe("/parent/foo bar.txt");
		});
	});

	describe("toString()", () => {
		test("returns [StorageDirectoryImpl endpoint://path]", () => {
			const endpoint = new MemoryEndpoint({});
			const dir = create("/path/to/dir/", endpoint);
			expect(dir.toString()).toBe("[StorageDirectoryImpl memory://path/to/dir/]");
		});
	});

	describe("reference equality", () => {
		test("directories preserve reference equality", async () => {
			// Same name from same directory
			expect(disk.directory("foo")).toBe(disk.directory("foo"));

			// Same path from chained calls
			expect(disk.directory("a").directory("b")).toBe(disk.directory("a").directory("b"));

			// Parent references
			const dir = disk.directory("a").directory("b").directory("c");
			expect(dir.parent).toBe(dir.parent);
			expect(dir.parent).toBe(disk.directory("a").directory("b"));

			// Root directory
			expect(disk.directory("a").parent).toBe(disk.directory("a").parent);

			// Entries from listing return cached instances
			const subdir = disk.directory("subdir");
			const listed = await subdir.listDirectories();
			expect(listed[0]).toBe(disk.directory("subdir").directory("a"));
		});

		test("files preserve reference equality", async () => {
			// Same name from same directory
			expect(disk.file("foo.txt")).toBe(disk.file("foo.txt"));

			// Same path from different parent directories
			expect(disk.directory("a").file("b.txt")).toBe(disk.directory("a").file("b.txt"));

			// Parent directory of file
			const file = disk.directory("a").directory("b").file("c.txt");
			expect(file.parent).toBe(file.parent);
			expect(file.parent).toBe(disk.directory("a").directory("b"));

			// Entries from listing return cached instances
			const subdir = disk.directory("subdir");
			const listed = await subdir.listFiles();
			expect(listed[0]).toBe(disk.directory("subdir").file("file1.txt"));
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

			const startEvent = new StorageDirectoryExistenceCheckingEvent(eventDisk, "/subdir/");
			const endEvent = new StorageDirectoryExistenceCheckedEvent(startEvent, exists);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("list() dispatches directory:list events via listStreaming()", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.list();

			const startEvent = new StorageDirectoryListingEvent(eventDisk, "/subdir/", "all", false);
			const endEvent = new StorageDirectoryListedEvent(startEvent, 4); // 2 dirs + 2 files
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listStreaming() dispatches directory:list events once", async () => {
			const dir = eventDisk.directory("subdir");

			for await (const _entry of dir.listStreaming()) {
				// Consume the generator
			}

			const startEvent = new StorageDirectoryListingEvent(eventDisk, "/subdir/", "all", false);
			const endEvent = new StorageDirectoryListedEvent(startEvent, 4); // 2 dirs + 2 files
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listFiles() dispatches directory:list events via listFilesStreaming() with recursive:false", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.listFiles();

			const startEvent = new StorageDirectoryListingEvent(eventDisk, "/subdir/", "files", false);
			const endEvent = new StorageDirectoryListedEvent(startEvent, 2); // 2 immediate files
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listFiles({recursive:true}) dispatches directory:list events via listFilesStreaming() with recursive:true", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.listFiles({ recursive: true });

			const startEvent = new StorageDirectoryListingEvent(eventDisk, "/subdir/", "files", true);
			const endEvent = new StorageDirectoryListedEvent(startEvent, 6); // All 6 files recursively
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listFilesStreaming() dispatches same events as listFiles()", async () => {
			const dir = eventDisk.directory("subdir");

			for await (const _file of dir.listFilesStreaming({ recursive: true })) {
				// Consume the generator
			}

			const startEvent = new StorageDirectoryListingEvent(eventDisk, "/subdir/", "files", true);
			const endEvent = new StorageDirectoryListedEvent(startEvent, 6);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listDirectories() dispatches directory:list events via listDirectoriesStreaming()", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.listDirectories();

			const startEvent = new StorageDirectoryListingEvent(
				eventDisk,
				"/subdir/",
				"directories",
				false,
			);
			const endEvent = new StorageDirectoryListedEvent(startEvent, 2); // 2 immediate directories
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("listDirectoriesStreaming() dispatches directory:list events once", async () => {
			const dir = eventDisk.directory("subdir");

			for await (const _dir of dir.listDirectoriesStreaming()) {
				// Consume the generator
			}

			const startEvent = new StorageDirectoryListingEvent(
				eventDisk,
				"/subdir/",
				"directories",
				false,
			);
			const endEvent = new StorageDirectoryListedEvent(startEvent, 2); // 2 immediate directories
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("deleteAll() dispatches directory:delete events once", async () => {
			const dir = eventDisk.directory("subdir");

			await dir.deleteAll();

			const startEvent = new StorageDirectoryDeletingEvent(eventDisk, "/subdir/");
			const endEvent = new StorageDirectoryDeletedEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});
	});
});
