import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestApplication } from "../../../test-utils/http.test-utils.ts";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { mockPlatformPaths } from "../../path-operations.ts";
import { filesystemStorage } from "./filesystemStorage.ts";

beforeEach(() => {
	mockPlatformPaths("posix");
});

describe("Filesystem storage integration", () => {
	test("writes files to actual filesystem using createTestApplication", async () => {
		const tempDir = createTestDirectory();
		const { app } = createTestApplication({
			disks: {
				local: filesystemStorage({ rootPath: tempDir }),
			},
			defaultDisk: "local",
		});

		// Write via storage API
		await app.storage.file("test.txt").put("content");

		// Verify with real fs API
		const content = readFileSync(join(tempDir, "test.txt"), "utf-8");
		expect(content).toBe("content");
		expect(existsSync(join(tempDir, "test.txt"))).toBe(true);
	});

	test("creates nested directories when writing files", async () => {
		const tempDir = createTestDirectory();
		const { app } = createTestApplication({
			disks: {
				local: filesystemStorage({ rootPath: tempDir }),
			},
			defaultDisk: "local",
		});

		// Write file in nested path
		await app.storage.file("a/b/c/nested.txt").put("nested content");

		// Verify nested structure exists on filesystem
		const content = readFileSync(join(tempDir, "a", "b", "c", "nested.txt"), "utf-8");
		expect(content).toBe("nested content");
		expect(existsSync(join(tempDir, "a", "b", "c"))).toBe(true);
	});
});
