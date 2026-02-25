import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestApplication } from "../../../test-utils/http.test-utils.ts";
import { createTestDirectory } from "../../../testing/test-directories.ts";
import { mockPlatformPaths } from "../../path-operations.ts";
import { filesystemStorage } from "../filesystem/filesystemStorage.ts";
import { scopedStorage } from "./scopedStorage.ts";

beforeEach(() => {
	mockPlatformPaths("posix");
});

describe("Scoped storage integration", () => {
	test("scoped storage with string disk name", async () => {
		const tempDir = createTestDirectory();
		const { app } = createTestApplication({
			disks: {
				local: filesystemStorage({ rootPath: tempDir }),
				scoped: scopedStorage({
					disk: "local",
					prefix: "/scoped-root/",
				}),
			},
			defaultDisk: "scoped",
		});

		// Write nested path through scoped disk
		await app.storage.file("a/b/c/nested.txt").put("nested content");

		// Verify file is in scoped location on real filesystem
		const content = readFileSync(
			join(tempDir, "scoped-root", "a", "b", "c", "nested.txt"),
			"utf-8",
		);
		expect(content).toBe("nested content");

		// Verify isolation - file not accessible at root
		expect(existsSync(join(tempDir, "a", "b", "c", "nested.txt"))).toBe(false);
	});

	test("scoped storage with ConfiguredStorageDriver", async () => {
		const tempDir = createTestDirectory();
		const { app } = createTestApplication({
			disks: {
				videos: scopedStorage({
					disk: filesystemStorage({ rootPath: tempDir }),
					prefix: "/videos/",
				}),
			},
			defaultDisk: "videos",
		});

		await app.storage.disk("videos").file("clip.mp4").put("video data");

		const videoContent = readFileSync(join(tempDir, "videos", "clip.mp4"), "utf-8");
		expect(videoContent).toBe("video data");

		expect(await app.storage.disk("videos").file("clip.mp4").exists()).toBe(true);
		expect(await app.storage.disk("videos").file("photo.jpg").exists()).toBe(false);
	});
});
