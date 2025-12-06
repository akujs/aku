import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { expectError } from "../test-utils/error.bun.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
import { spyOnAll } from "../test-utils/spy-on-all.bun.ts";
import { resetAllMocks } from "../testing/mocks.ts";
import { MemoryEndpoint } from "./adapters/memory/MemoryEndpoint.ts";
import { memoryStorage } from "./adapters/memory/memoryStorage.ts";
import type { StorageAdapter, StorageDisk } from "./contracts/Storage.ts";
import { StorageDiskImpl } from "./StorageDiskImpl.ts";
import type { StorageEndpointBuilder } from "./StorageEndpointBuilder.ts";
import { StorageImpl } from "./StorageImpl.ts";
import { DiskNotFoundError } from "./storage-errors.ts";
import { mockEndpointBuilder } from "./storage-test-utils.bun.ts";

function createStorageImpl(
	config: { disks?: Record<string, StorageAdapter>; defaultDisk?: string },
	dispatcher?: Dispatcher,
	builder?: StorageEndpointBuilder,
): StorageImpl {
	return new StorageImpl(config, dispatcher ?? mockDispatcher(), builder ?? mockEndpointBuilder());
}

describe(StorageImpl, () => {
	let storage: StorageImpl;

	beforeEach(() => {
		storage = createStorageImpl({
			disks: { local: memoryStorage({}) },
		});
	});

	describe("disk()", () => {
		test("returns default disk when name omitted", () => {
			storage = createStorageImpl({
				disks: { local: memoryStorage({}) },
				defaultDisk: "local",
			});
			expect(storage.disk().name).toBe("local");
		});

		test("returns named disk when name provided", () => {
			storage = createStorageImpl({
				disks: {
					first: memoryStorage({}),
					second: memoryStorage({}),
				},
			});
			expect(storage.disk("second").name).toBe("second");
		});

		test("throws clear error when disk doesn't exist", () => {
			expectError(
				() => storage.disk("nonexistent"),
				DiskNotFoundError,
				(error) => {
					expect(error.diskName).toBe("nonexistent");
				},
			);
		});

		test("throws when default disk doesn't exist", () => {
			const storageWithoutDefault = createStorageImpl({
				disks: { other: memoryStorage({}) },
				// No defaultDisk configured, falls back to "local" which doesn't exist
			});
			expectError(
				() => storageWithoutDefault.disk(),
				DiskNotFoundError,
				(error) => {
					expect(error.diskName).toBe("local");
				},
			);
		});

		test("disk() always returns same instance for same name", () => {
			const disk1 = storage.disk("local");
			const disk2 = storage.disk("local");
			expect(disk1).toBe(disk2);
		});
	});

	describe("build()", () => {
		test("creates disk from endpoint", () => {
			const built = storage.build(memoryStorage({}));
			expect(built).toBeInstanceOf(StorageDiskImpl);
			expect(built.name).toStartWith("anon");
		});

		test("built disk not registered by name", () => {
			const disk = storage.build(memoryStorage({}));
			expect(() => storage.disk(disk.name)).toThrow(DiskNotFoundError);
		});

		test("multiple build() calls create independent disks", () => {
			const built1 = storage.build(memoryStorage({}));
			const built2 = storage.build(memoryStorage({}));
			expect(built1).not.toBe(built2);
		});
	});

	describe("mock()", () => {
		test("replaces existing disk", async () => {
			const storage = createStorageImpl({
				disks: {
					test: memoryStorage({
						initialFiles: {
							"/old.txt": "old data",
						},
					}),
				},
			});

			// Verify old file exists
			expect(await storage.disk("test").file("old.txt").exists()).toBe(true);

			// Mock the disk
			storage.mock("test");

			// Old file should no longer exist
			expect(await storage.disk("test").file("old.txt").exists()).toBe(false);
		});

		test("accepts custom endpoint", async () => {
			const storage = createStorageImpl({
				disks: { test: memoryStorage({}) },
			});

			storage.mock(
				"test",
				new MemoryEndpoint({
					initialFiles: {
						"/custom.txt": "custom data",
					},
				}),
			);

			expect(await storage.disk("test").file("custom.txt").exists()).toBe(true);
		});
	});

	describe("resetMocks()", () => {
		test("restores multiple mocked disks", async () => {
			const storage = createStorageImpl({
				disks: {
					disk1: memoryStorage({
						initialFiles: {
							"/file1.txt": "data1",
						},
					}),
					disk2: memoryStorage({
						initialFiles: {
							"/file2.txt": "data2",
						},
					}),
				},
			});

			storage.mock("disk1");
			// mock disk2 twice
			storage.mock("disk2");
			storage.mock("disk2");

			// Verify original files are gone
			expect(await storage.disk("disk1").file("file1.txt").exists()).toBe(false);
			expect(await storage.disk("disk2").file("file2.txt").exists()).toBe(false);

			// Reset all mocks
			storage.resetMocks();

			// Both original files should be back
			expect(await storage.disk("disk1").file("file1.txt").exists()).toBe(true);
			expect(await storage.disk("disk2").file("file2.txt").exists()).toBe(true);
		});
	});

	describe("resetAllMocks() integration", () => {
		test("resets storage mocks when resetAllMocks is called", async () => {
			const storage = createStorageImpl({
				disks: {
					local: memoryStorage({
						initialFiles: {
							"/original.txt": "original data",
						},
					}),
				},
			});

			// Mock the disk
			storage.mock("local");

			// Verify original file is gone
			expect(await storage.disk("local").file("original.txt").exists()).toBe(false);

			// Call global reset
			resetAllMocks();

			// Original file should be back
			expect(await storage.disk("local").file("original.txt").exists()).toBe(true);
		});

		test("supports multiple mock and reset cycles", async () => {
			const storage = createStorageImpl({
				disks: {
					local: memoryStorage({
						initialFiles: {
							"/original.txt": "original data",
						},
					}),
				},
			});

			// First cycle
			storage.mock("local");
			expect(await storage.disk("local").file("original.txt").exists()).toBe(false);
			resetAllMocks();
			expect(await storage.disk("local").file("original.txt").exists()).toBe(true);

			// Second cycle
			storage.mock("local");
			storage.mock("local");
			expect(await storage.disk("local").file("original.txt").exists()).toBe(false);
			resetAllMocks();
			expect(await storage.disk("local").file("original.txt").exists()).toBe(true);

			// no damage calling it when not required
			resetAllMocks();
			resetAllMocks();
			expect(await storage.disk("local").file("original.txt").exists()).toBe(true);
		});
	});

	describe("directory operations delegation", () => {
		let mockDisk: StorageDisk;
		let storage: StorageImpl;

		beforeEach(() => {
			// Create a mock disk with mocked directory operations
			const endpoint = new MemoryEndpoint({});
			mockDisk = spyOnAll(new StorageDiskImpl("mock-disk", endpoint, mockDispatcher()));

			// Create storage and override disk() to return our mock
			storage = createStorageImpl({
				disks: { local: memoryStorage({}) },
				defaultDisk: "local",
			});
			storage.disk = mock(() => mockDisk);
		});

		test("storage.exists() delegates to default disk", async () => {
			await storage.exists();
			expect(mockDisk.exists).toHaveBeenCalled();
		});

		test("storage.list() delegates to default disk", async () => {
			await storage.list();
			expect(mockDisk.list).toHaveBeenCalled();
		});

		test("storage.listStreaming() delegates to default disk", () => {
			storage.listStreaming();
			expect(mockDisk.listStreaming).toHaveBeenCalled();
		});

		test("storage.listFiles() delegates to default disk", async () => {
			await storage.listFiles();
			expect(mockDisk.listFiles).toHaveBeenCalled();
		});

		test("storage.listFiles(options) delegates to default disk with options", async () => {
			await storage.listFiles({ recursive: true });
			expect(mockDisk.listFiles).toHaveBeenCalledWith({ recursive: true });
		});

		test("storage.listFilesStreaming() delegates to default disk", () => {
			storage.listFilesStreaming();
			expect(mockDisk.listFilesStreaming).toHaveBeenCalled();
		});

		test("storage.listDirectories() delegates to default disk", async () => {
			await storage.listDirectories();
			expect(mockDisk.listDirectories).toHaveBeenCalled();
		});

		test("storage.listDirectoriesStreaming() delegates to default disk", () => {
			storage.listDirectoriesStreaming();
			expect(mockDisk.listDirectoriesStreaming).toHaveBeenCalled();
		});

		test("storage.deleteAll() delegates to default disk", async () => {
			await storage.deleteAll();
			expect(mockDisk.deleteAll).toHaveBeenCalled();
		});

		test("storage.directory(path) delegates to default disk with path", () => {
			storage.directory("subdir");
			expect(mockDisk.directory).toHaveBeenCalledWith("subdir");
		});

		test("storage.file(path) delegates to default disk with path", () => {
			storage.file("test.txt");
			expect(mockDisk.file).toHaveBeenCalledWith("test.txt");
		});
	});

	describe("toString()", () => {
		test("returns [StorageImpl]", () => {
			expect(storage.toString()).toBe("[StorageImpl]");
		});
	});
});
