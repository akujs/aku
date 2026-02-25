import { beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTestApplication } from "../../../test-utils/http.test-utils.ts";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { mockPlatformPaths } from "../../path-operations.ts";
import { mockEndpointBuilder } from "../../storage.test-utils.ts";
import { PermissionsError } from "../../storage-errors.ts";
import { filesystemStorage } from "../filesystem/filesystemStorage.ts";
import { memoryStorage } from "../memory/memoryStorage.ts";
import { readOnlyStorage } from "./readOnlyStorage.ts";

beforeEach(() => {
	mockPlatformPaths("posix");
});

describe("read-only storage integration", () => {
	test("with string disk name", async () => {
		const tempDir = createTestDirectory();
		const { app } = createTestApplication({
			disks: {
				local: filesystemStorage({ rootPath: tempDir }),
				readonly: readOnlyStorage({
					disk: "local",
				}),
			},
			defaultDisk: "readonly",
		});

		writeFileSync(join(tempDir, "existing.txt"), "existing content");

		const file = app.storage.file("existing.txt");

		const fetchResult = await file.get();
		expect(await fetchResult.response.text()).toBe("existing content");

		expect(file.put("new content")).rejects.toThrow(PermissionsError);
	});

	test("with endpoint", async () => {
		const endpont = mockEndpointBuilder().build(
			memoryStorage({
				initialFiles: {
					"/data.json": "existing content",
				},
			}),
		);
		const { app } = createTestApplication({
			disks: {
				readonly: readOnlyStorage({
					disk: endpont,
				}),
			},
			defaultDisk: "readonly",
		});

		const file = app.storage.file("/data.json");

		const fetchResult = await file.get();
		expect(await fetchResult.response.text()).toBe("existing content");

		expect(file.put("new content")).rejects.toThrow(PermissionsError);
	});

	test("prevents all write operations", async () => {
		const tempDir = createTestDirectory();
		const { app } = createTestApplication({
			disks: {
				local: filesystemStorage({ rootPath: tempDir }),
				readonly: readOnlyStorage({ disk: "local" }),
			},
		});

		// Set up test files
		writeFileSync(join(tempDir, "source.txt"), "source content");

		const readonlyDisk = app.storage.disk("readonly");

		const captureState = async () => {
			const files = await app.storage.disk("local").listFiles({ recursive: true });
			return Promise.all(
				files.map(async (f) => {
					const { response } = await f.get();
					return {
						path: f.path,
						content: await response.text(),
					};
				}),
			);
		};

		const stateBefore = await captureState();

		expect(stateBefore).toEqual([
			{
				content: "source content",
				path: "/source.txt",
			},
		]);

		// Cannot write
		expect(readonlyDisk.file("new.txt").put("content")).rejects.toThrow(PermissionsError);

		// Cannot delete
		expect(readonlyDisk.file("source.txt").delete()).rejects.toThrow(PermissionsError);

		// Cannot copy
		expect(readonlyDisk.file("source.txt").copyTo(readonlyDisk.file("copy.txt"))).rejects.toThrow(
			PermissionsError,
		);

		// Cannot move
		expect(readonlyDisk.file("source.txt").moveTo(readonlyDisk.file("moved.txt"))).rejects.toThrow(
			PermissionsError,
		);

		expect(await captureState()).toEqual(stateBefore);
	});

	test("read operations work correctly", async () => {
		const tempDir = createTestDirectory();
		const { app } = createTestApplication({
			disks: {
				local: filesystemStorage({ rootPath: tempDir }),
				readonly: readOnlyStorage({ disk: "local" }),
			},
			defaultDisk: "readonly",
		});

		// Set up test files directly on filesystem
		const localDisk = app.storage.disk("local");
		await localDisk.file("file1.txt").put("content 1");
		await localDisk.file("file2.txt").put("content 2");
		await localDisk.file("subdir/file3.txt").put("content 3");

		const readonlyDisk = app.storage.disk("readonly");

		// Test reading
		expect(await (await readonlyDisk.file("file1.txt").get()).response.text()).toBe("content 1");
		expect(await (await readonlyDisk.file("file2.txt").get()).response.text()).toBe("content 2");

		// Test existence checks
		expect(await readonlyDisk.file("file1.txt").exists()).toBe(true);
		expect(await readonlyDisk.file("nonexistent.txt").exists()).toBe(false);

		// Test listing
		const files = await readonlyDisk.directory("/").listFiles({ recursive: true });
		expect(files).toHaveLength(3);
		expect(files.map((f) => f.path).sort()).toEqual([
			"/file1.txt",
			"/file2.txt",
			"/subdir/file3.txt",
		]);
	});
});
