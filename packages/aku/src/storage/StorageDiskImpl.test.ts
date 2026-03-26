import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mockDispatcher } from "../test-utils/internal-mocks.test-utils.ts";
import { spyOnAll } from "../test-utils/spy-on-all.test-utils.ts";
import { MemoryEndpoint } from "./adapters/memory/MemoryEndpoint.ts";
import type {
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
} from "./contracts/Storage.ts";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl.ts";
import { StorageDiskImpl } from "./StorageDiskImpl.ts";

describe(StorageDiskImpl, () => {
	const create = (name: string, ep: StorageEndpoint): StorageDisk => {
		return new StorageDiskImpl(name, ep, mockDispatcher());
	};

	describe("constructor", () => {
		test("stores name and endpoint correctly", () => {
			const endpoint = new MemoryEndpoint({});
			const disk = create("test-disk", endpoint);
			expect(disk.name).toBe("test-disk");
		});
	});

	describe("directory operations delegation", () => {
		let mockRoot: StorageDirectoryOperations;
		let disk: StorageDiskImpl;

		beforeEach(() => {
			const endpoint = new MemoryEndpoint({});
			disk = new StorageDiskImpl("test-disk", endpoint, mockDispatcher());
			mockRoot = spyOnAll(new StorageDirectoryImpl(disk, endpoint, "/", mockDispatcher()));
			// Override getDirectoryForDelegation to return our mock
			(disk as any).getDirectoryForDelegation = mock(() => mockRoot);
		});

		test("disk.exists() delegates to root directory", async () => {
			await disk.exists();
			expect(mockRoot.exists).toHaveBeenCalled();
		});

		test("disk.list() delegates to root directory", async () => {
			await disk.list();
			expect(mockRoot.list).toHaveBeenCalled();
		});

		test("disk.listStreaming() delegates to root directory", () => {
			disk.listStreaming();
			expect(mockRoot.listStreaming).toHaveBeenCalled();
		});

		test("disk.listFiles() delegates to root directory", async () => {
			await disk.listFiles();
			expect(mockRoot.listFiles).toHaveBeenCalled();
		});

		test("disk.listFiles(options) delegates to root directory with options", async () => {
			await disk.listFiles({ recursive: true });
			expect(mockRoot.listFiles).toHaveBeenCalledWith({ recursive: true });
		});

		test("disk.listFilesStreaming() delegates to root directory", () => {
			disk.listFilesStreaming();
			expect(mockRoot.listFilesStreaming).toHaveBeenCalled();
		});

		test("disk.listDirectories() delegates to root directory", async () => {
			await disk.listDirectories();
			expect(mockRoot.listDirectories).toHaveBeenCalled();
		});

		test("disk.listDirectoriesStreaming() delegates to root directory", () => {
			disk.listDirectoriesStreaming();
			expect(mockRoot.listDirectoriesStreaming).toHaveBeenCalled();
		});

		test("disk.deleteAll() delegates to root directory", async () => {
			await disk.deleteAll();
			expect(mockRoot.deleteAll).toHaveBeenCalled();
		});

		test("disk.directory(path) delegates to root directory with path", () => {
			disk.directory("subdir");
			expect(mockRoot.directory).toHaveBeenCalledWith("subdir");
		});

		test("disk.file(path) delegates to root directory with path", () => {
			disk.file("test.txt");
			expect(mockRoot.file).toHaveBeenCalledWith("test.txt");
		});
	});

	describe("path handling integration", () => {
		test("disk operations work on root path", async () => {
			const endpoint = new MemoryEndpoint({
				initialFiles: {
					"/test.txt": "root file",
					"/subdir/nested.txt": "nested file",
				},
			});
			const disk = create("test-disk", endpoint);

			const file = disk.file("test.txt");
			expect(await file.exists()).toBe(true);
			const fetchResult = await file.get();
			expect(await fetchResult.response.text()).toBe("root file");

			const dir = disk.directory("subdir");
			const files = await dir.listFiles();
			expect(files.length).toBe(1);
			expect(files[0].path).toBe("/subdir/nested.txt");
		});
	});

	describe("toString()", () => {
		test("returns [StorageDiskImpl diskname]", () => {
			const endpoint = new MemoryEndpoint({});
			const disk = create("my-disk", endpoint);
			expect(disk.toString()).toBe("[StorageDiskImpl memory://my-disk]");
		});
	});
});
