import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { StorageEndpoint } from "../../contracts/Storage.ts";
import { PermissionsError } from "../../storage-errors.ts";
import { type SharedTestConfig } from "../../storage-test-utils.bun.ts";
import { MemoryEndpoint } from "../memory/MemoryEndpoint.ts";
import { ReadOnlyEndpoint } from "./ReadOnlyEndpoint.ts";
import { readOnlyStorage } from "./readOnlyStorage.ts";

// Dummy factory for tests - never called since we pass StorageEndpoint directly
const dummyStorageFactory = () => {
	throw new Error("Should not be called in unit tests with direct StorageEndpoint");
};

export const readOnlyStorageSharedTestConfig: SharedTestConfig[] = [
	{
		name: readOnlyStorage.name,
		createEndpoint: () =>
			new ReadOnlyEndpoint(
				{
					disk: new MemoryEndpoint({}),
				},
				dummyStorageFactory,
			),
	},
];

describe(readOnlyStorage, () => {
	let wrappedDisk: StorageEndpoint;
	let readOnlyDisk: StorageEndpoint;

	beforeEach(() => {
		wrappedDisk = new MemoryEndpoint({});
		readOnlyDisk = new ReadOnlyEndpoint(
			{
				disk: wrappedDisk,
			},
			dummyStorageFactory,
		);
	});

	test("readSingle() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "readSingle");

		await wrappedDisk.writeSingle({
			path: "/file.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await readOnlyDisk.readSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/file.txt");
	});

	test("getInfoSingle() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "getInfoSingle");

		await wrappedDisk.writeSingle({
			path: "/file.txt",
			data: "content",
			mimeType: "text/plain",
		});

		await readOnlyDisk.getInfoSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/file.txt");
	});

	test("existsSingle() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "existsSingle");

		await readOnlyDisk.existsSingle("/file.txt");

		expect(spy).toHaveBeenCalledWith("/file.txt");
	});

	test("existsAnyUnderPrefix() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "existsAnyUnderPrefix");

		await readOnlyDisk.existsAnyUnderPrefix("/subfolder/");

		expect(spy).toHaveBeenCalledWith("/subfolder/");
	});

	test("listEntries() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "listEntries");

		await Array.fromAsync(readOnlyDisk.listEntries("/subfolder/"));

		expect(spy).toHaveBeenCalledWith("/subfolder/");
	});

	test("listFilesRecursive() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "listFilesRecursive");

		await Array.fromAsync(readOnlyDisk.listFilesRecursive("/subfolder/"));

		expect(spy).toHaveBeenCalledWith("/subfolder/");
	});

	test("getPublicDownloadUrl() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "getPublicDownloadUrl").mockResolvedValue("mocked-url");

		const result = await readOnlyDisk.getPublicDownloadUrl("/file.txt", "download.txt");

		expect(spy).toHaveBeenCalledWith("/file.txt", "download.txt");
		expect(result).toBe("mocked-url");
	});

	test("getSignedDownloadUrl() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "getSignedDownloadUrl").mockResolvedValue("mocked-url");
		const expires = new Date();

		const result = await readOnlyDisk.getSignedDownloadUrl("/file.txt", expires, "download.txt");

		expect(spy).toHaveBeenCalledWith("/file.txt", expires, "download.txt");
		expect(result).toBe("mocked-url");
	});

	test("getTemporaryUploadUrl() delegates to wrapped disk", async () => {
		const spy = spyOn(wrappedDisk, "getTemporaryUploadUrl").mockResolvedValue("mocked-url");
		const expires = new Date();

		const result = await readOnlyDisk.getTemporaryUploadUrl("/file.txt", expires);

		expect(spy).toHaveBeenCalledWith("/file.txt", expires);
		expect(result).toBe("mocked-url");
	});

	test("writeSingle() throws PermissionsError", async () => {
		expect(
			readOnlyDisk.writeSingle({
				path: "/file.txt",
				data: "content",
				mimeType: "text/plain",
			}),
		).rejects.toThrow(PermissionsError);
	});

	test("copy() throws PermissionsError", async () => {
		expect(readOnlyDisk.copy("/source.txt", "/dest.txt")).rejects.toThrow(PermissionsError);
	});

	test("move() throws PermissionsError", async () => {
		expect(readOnlyDisk.move("/source.txt", "/dest.txt")).rejects.toThrow(PermissionsError);
	});

	test("deleteSingle() throws PermissionsError", async () => {
		expect(readOnlyDisk.deleteSingle("/file.txt")).rejects.toThrow(PermissionsError);
	});

	test("deleteAllUnderPrefix() throws PermissionsError", async () => {
		expect(readOnlyDisk.deleteAllUnderPrefix("/subfolder/")).rejects.toThrow(PermissionsError);
	});

	test("forwards supportsMimeTypes from wrapped disk", () => {
		const diskWithMime = new MemoryEndpoint({ supportsMimeTypes: true });
		const diskWithoutMime = new MemoryEndpoint({ supportsMimeTypes: false });

		const readOnlyWithMime = new ReadOnlyEndpoint({ disk: diskWithMime }, dummyStorageFactory);
		const readOnlyWithoutMime = new ReadOnlyEndpoint(
			{ disk: diskWithoutMime },
			dummyStorageFactory,
		);

		expect(readOnlyWithMime.supportsMimeTypes).toBe(true);
		expect(readOnlyWithoutMime.supportsMimeTypes).toBe(false);
	});

	test("forwards invalidNameChars from wrapped disk", () => {
		const diskWithInvalid = new MemoryEndpoint({ invalidNameChars: '<>:"' });
		const diskWithoutInvalid = new MemoryEndpoint({ invalidNameChars: "" });

		const readOnlyWithInvalid = new ReadOnlyEndpoint(
			{ disk: diskWithInvalid },
			dummyStorageFactory,
		);
		const readOnlyWithoutInvalid = new ReadOnlyEndpoint(
			{ disk: diskWithoutInvalid },
			dummyStorageFactory,
		);

		expect(readOnlyWithInvalid.invalidNameChars).toBe('<>:"');
		expect(readOnlyWithoutInvalid.invalidNameChars).toBe("");
	});

	test("has name", () => {
		expect(readOnlyDisk.name).toBe("read-only");
	});
});
