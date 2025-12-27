import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mockDispatcher } from "../../../test-utils/internal-mocks.bun.ts";
import type { StorageEndpoint } from "../../contracts/Storage.ts";
import { StorageImpl } from "../../StorageImpl.ts";
import { mockEndpointBuilder, type SharedTestConfig } from "../../storage-test-utils.bun.ts";
import { MemoryEndpoint } from "../memory/MemoryEndpoint.ts";
import { ScopedEndpoint } from "./ScopedEndpoint.ts";
import { scopedStorage } from "./scopedStorage.ts";

// Dummy factory for tests - never called since we pass StorageEndpoint directly
const dummyStorageFactory = () => {
	throw new Error("Should not be called in unit tests with direct StorageEndpoint");
};

export const scopedStorageSharedTestConfig: SharedTestConfig[] = [
	{
		name: `${scopedStorage.name} on "/"`,
		createEndpoint: () =>
			new ScopedEndpoint(
				{
					disk: new MemoryEndpoint({ fakeUrls: true }),
					prefix: "/",
				},
				dummyStorageFactory,
			),
	},
	{
		name: `${scopedStorage.name} on "/scoped/"`,
		createEndpoint: () =>
			new ScopedEndpoint(
				{
					disk: new MemoryEndpoint({ fakeUrls: true }),
					prefix: "/scoped/",
				},
				dummyStorageFactory,
			),
	},
];

describe(scopedStorage, () => {
	let wrappedDisk: StorageEndpoint;
	let scopedDisk: StorageEndpoint;

	beforeEach(() => {
		wrappedDisk = new MemoryEndpoint({});
		scopedDisk = new ScopedEndpoint(
			{
				disk: wrappedDisk,
				prefix: "/videos/",
			},
			dummyStorageFactory,
		);
	});

	test("writeSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "writeSingle");

		await scopedDisk.writeSingle({
			path: "/tutorial.mp4",
			data: "video-content",
			mimeType: "video/mp4",
		});

		expect(spy).toHaveBeenCalledWith({
			path: "/videos/tutorial.mp4",
			data: "video-content",
			mimeType: "video/mp4",
		});
	});

	test("readSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "readSingle");

		await wrappedDisk.writeSingle({
			path: "/videos/file.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await scopedDisk.readSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt");
	});

	test("getInfoSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "getInfoSingle");

		await wrappedDisk.writeSingle({
			path: "/videos/file.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await scopedDisk.getInfoSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt");
	});

	test("existsSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "existsSingle");

		await scopedDisk.existsSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt");
	});

	test("existsAnyUnderPrefix() prepends prefix to prefix parameter", async () => {
		const spy = spyOn(wrappedDisk, "existsAnyUnderPrefix");

		await scopedDisk.existsAnyUnderPrefix("/subfolder/");

		expect(spy).toHaveBeenCalledWith("/videos/subfolder/");
	});

	test("copy() prepends prefix to both source and destination", async () => {
		const spy = spyOn(wrappedDisk, "copy");

		await wrappedDisk.writeSingle({
			path: "/videos/source.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await scopedDisk.copy("/source.txt", "/dest.txt");

		expect(spy).toHaveBeenCalledWith("/videos/source.txt", "/videos/dest.txt");
	});

	test("move() prepends prefix to both source and destination", async () => {
		const spy = spyOn(wrappedDisk, "move");

		await wrappedDisk.writeSingle({
			path: "/videos/source.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await scopedDisk.move("/source.txt", "/dest.txt");

		expect(spy).toHaveBeenCalledWith("/videos/source.txt", "/videos/dest.txt");
	});

	test("deleteSingle() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "deleteSingle");

		await scopedDisk.deleteSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt");
	});

	test("deleteAllUnderPrefix() prepends prefix to prefix parameter", async () => {
		const spy = spyOn(wrappedDisk, "deleteAllUnderPrefix");

		await scopedDisk.deleteAllUnderPrefix("/subfolder/");

		expect(spy).toHaveBeenCalledWith("/videos/subfolder/");
	});

	test("listEntries() prepends prefix to prefix parameter", async () => {
		const spy = spyOn(wrappedDisk, "listEntries");

		await Array.fromAsync(scopedDisk.listEntries("/subfolder/"));

		expect(spy).toHaveBeenCalledWith("/videos/subfolder/");
	});

	test("listFilesRecursive() prepends prefix to prefix parameter", async () => {
		const spy = spyOn(wrappedDisk, "listFilesRecursive");

		await Array.fromAsync(scopedDisk.listFilesRecursive("/subfolder/"));

		expect(spy).toHaveBeenCalledWith("/videos/subfolder/");
	});

	test("getPublicDownloadUrl() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "getPublicDownloadUrl").mockResolvedValue("mocked-url");

		const result = await scopedDisk.getPublicDownloadUrl("/file.txt", "download.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt", "download.txt");
		expect(result).toBe("mocked-url");
	});

	test("getSignedDownloadUrl() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "getSignedDownloadUrl").mockResolvedValue("mocked-url");
		const expires = new Date();

		const result = await scopedDisk.getSignedDownloadUrl("/file.txt", expires, "download.txt");

		expect(spy).toHaveBeenCalledWith("/videos/file.txt", expires, "download.txt");
		expect(result).toBe("mocked-url");
	});

	test("getTemporaryUploadUrl() prepends prefix to path", async () => {
		const spy = spyOn(wrappedDisk, "getTemporaryUploadUrl").mockResolvedValue("mocked-url");
		const expires = new Date();

		const result = await scopedDisk.getTemporaryUploadUrl("/file.txt", expires);

		expect(spy).toHaveBeenCalledWith("/videos/file.txt", expires);
		expect(result).toBe("mocked-url");
	});

	test("operations are isolated to the scoped prefix", async () => {
		// Write files outside the scope
		await wrappedDisk.writeSingle({
			path: "/other/file.txt",
			data: "outside",
			mimeType: "text/plain",
		});

		// Write files inside the scope
		await scopedDisk.writeSingle({
			path: "/inside.txt",
			data: "inside",
			mimeType: "text/plain",
		});

		// Scoped disk should only see files in its prefix
		expect(await scopedDisk.existsSingle("/inside.txt")).toBe(true);
		expect(await scopedDisk.existsSingle("/other/file.txt")).toBe(false);

		// Wrapped disk should see both
		expect(await wrappedDisk.existsSingle("/videos/inside.txt")).toBe(true);
		expect(await wrappedDisk.existsSingle("/other/file.txt")).toBe(true);
	});

	test("path normalization works with scoped storage", async () => {
		const storage = new StorageImpl(
			{
				disks: { scoped: scopedDisk },
				defaultDisk: "scoped",
			},
			mockDispatcher(),
			mockEndpointBuilder(),
		);

		const disk = storage.disk();

		// Set up a file outside the scoped area in the wrapped disk
		await wrappedDisk.writeSingle({
			path: "/secret.txt",
			data: "secret-content",
			mimeType: "text/plain",
		});

		// Path normalization stops at / (the root of the scoped disk, which is /videos/)
		// So /../secret.txt normalizes to /secret.txt within the scope
		// This accesses /videos/secret.txt on the wrapped disk, not /secret.txt
		expect(await disk.file("/../../secret.txt").exists()).toBe(false);
		expect(await disk.file("../../secret.txt").exists()).toBe(false);
		expect(await disk.directory("/").file("secret.txt").exists()).toBe(false);
		expect(await disk.directory("../../..").file("secret.txt").exists()).toBe(false);
	});

	test("forwards supportsMimeTypes from wrapped disk", () => {
		const diskWithMime = new MemoryEndpoint({ supportsMimeTypes: true });
		const diskWithoutMime = new MemoryEndpoint({ supportsMimeTypes: false });

		const scopedWithMime = new ScopedEndpoint(
			{ disk: diskWithMime, prefix: "/test/" },
			dummyStorageFactory,
		);
		const scopedWithoutMime = new ScopedEndpoint(
			{
				disk: diskWithoutMime,
				prefix: "/test/",
			},
			dummyStorageFactory,
		);

		expect(scopedWithMime.supportsMimeTypes).toBe(true);
		expect(scopedWithoutMime.supportsMimeTypes).toBe(false);
	});

	test("forwards invalidNameChars from wrapped disk", () => {
		const diskWithInvalid = new MemoryEndpoint({ invalidNameChars: '<>:"' });
		const diskWithoutInvalid = new MemoryEndpoint({ invalidNameChars: "" });

		const scopedWithInvalid = new ScopedEndpoint(
			{
				disk: diskWithInvalid,
				prefix: "/test/",
			},
			dummyStorageFactory,
		);
		const scopedWithoutInvalid = new ScopedEndpoint(
			{
				disk: diskWithoutInvalid,
				prefix: "/test/",
			},
			dummyStorageFactory,
		);

		expect(scopedWithInvalid.invalidNameChars).toBe('<>:"');
		expect(scopedWithoutInvalid.invalidNameChars).toBe("");
	});

	test.each([
		["videos", "/file.txt", "/videos/file.txt"],
		["/videos", "/file.txt", "/videos/file.txt"],
		["videos/", "/file.txt", "/videos/file.txt"],
		["/videos/", "/file.txt", "/videos/file.txt"],
		["/", "/file.txt", "/file.txt"],
		["", "/file.txt", "/file.txt"],
		["/users/123/uploads/", "/file.txt", "/users/123/uploads/file.txt"],
	])('handles "%s" prefix and "%s" path', async (prefix, path, expected) => {
		const wrappedDisk = new MemoryEndpoint({});
		const spy = spyOn(wrappedDisk, "writeSingle");

		const scopedDisk = new ScopedEndpoint(
			{
				disk: wrappedDisk,
				prefix,
			},
			dummyStorageFactory,
		);

		await scopedDisk.writeSingle({
			path,
			data: "content",
			mimeType: "text/plain",
		});

		expect(spy).toHaveBeenCalledWith({
			path: expected,
			data: "content",
			mimeType: "text/plain",
		});
	});
});
