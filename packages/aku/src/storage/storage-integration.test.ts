import { describe, expect, test } from "bun:test";
import { createTestApplication } from "../test-utils/http.test-utils.ts";
import { memoryStorage } from "./adapters/memory/memoryStorage.ts";
import { Storage } from "./contracts/Storage.ts";
import { FileWrittenEvent } from "./storage-events.ts";

describe("Storage integration with Application", () => {
	test("storage integrates with application configuration and DI container", async () => {
		const { app } = createTestApplication({
			disks: {
				local: memoryStorage({}),
				uploads: memoryStorage({}),
			},
			defaultDisk: "uploads",
		});

		// Check configuration passed in
		expect(app.storage.disk("uploads").name).toBe("uploads");
		expect(app.storage.disk("uploads")).toBe(app.storage.disk());
		expect(app.storage.disk("uploads")).not.toBe(app.storage.disk("local"));

		// Smoke test writing and reading
		await app.storage.file("test.txt").put("content");
		const uploadedFile = await app.storage.disk("uploads").file("test.txt").get();
		expect(await uploadedFile.response.text()).toBe("content");

		// Test that storage events are dispatched via app.events
		const events: Array<FileWrittenEvent> = [];
		app.events.addListener(FileWrittenEvent, (event) => events.push(event));
		await app.storage.file("event-test.txt").put("event data");
		expect(events).toHaveLength(1);
		expect(events[0]).toBeInstanceOf(FileWrittenEvent);
	});

	test("storage works without disks configured", async () => {
		const { app } = createTestApplication({});
		// no disks defined so we'll have to build one to check
		const disk = app.storage.build(
			memoryStorage({
				initialFiles: {
					"test.txt": "content",
					"test2.txt": "content",
				},
			}),
		);
		expect(await disk.list()).toHaveLength(2);
	});

	test("storage is a singleton across container", () => {
		const { app, container } = createTestApplication({
			disks: {
				local: memoryStorage({}),
			},
		});

		const storage = app.storage;
		expect(storage).toBe(container.get(Storage));
		expect(storage).toBe(container.get(Storage));
		expect(storage).toBe(app.storage);
	});
});
