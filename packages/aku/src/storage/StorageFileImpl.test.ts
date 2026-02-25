import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { DispatcherImpl } from "../core/DispatcherImpl.ts";
import { expectError } from "../test-utils/error.test-utils.ts";
import { mockDispatcher } from "../test-utils/internal-mocks.test-utils.ts";
import { spyOnAll } from "../test-utils/spy-on-all.test-utils.ts";
import { mockCurrentTime, resetMockTime } from "../testing/mock-time.ts";
import { MemoryEndpoint } from "./adapters/memory/MemoryEndpoint.ts";
import type { StorageEndpoint, StorageFile } from "./contracts/Storage.ts";
import { StorageDiskImpl } from "./StorageDiskImpl.ts";
import { StorageFileImpl } from "./StorageFileImpl.ts";
import { InvalidPathError, NotFoundError } from "./storage-errors.ts";
import {
	FileCopiedEvent,
	FileCopyingEvent,
	FileDeletedEvent,
	FileDeletingEvent,
	FileExistenceCheckedEvent,
	FileExistenceCheckingEvent,
	FileInfoRetrievedEvent,
	FileInfoRetrievingEvent,
	FileMovedEvent,
	FileMovingEvent,
	FileReadEvent,
	FileReadingEvent,
	FileUrlGeneratedEvent,
	FileUrlGeneratingEvent,
	FileWritingEvent,
	FileWrittenEvent,
} from "./storage-events.ts";

describe(StorageFileImpl, () => {
	let endpoint: StorageEndpoint;
	let disk: StorageDiskImpl;
	let dispatcher: Dispatcher;

	beforeEach(() => {
		mockCurrentTime(new Date("2025-01-01T00:00:00Z"));
		endpoint = new MemoryEndpoint({});
		dispatcher = new DispatcherImpl(new ContainerImpl());
		disk = new StorageDiskImpl("test", endpoint, dispatcher);
	});

	const create = (path: string, ep = endpoint): StorageFile => {
		return new StorageFileImpl(disk, ep, path, mockDispatcher());
	};

	afterEach(() => {
		resetMockTime();
	});

	describe("constructor", () => {
		test("stores path, name and parent", () => {
			const file = create("/path/to/file.txt");
			expect(file.path).toBe("/path/to/file.txt");
			expect(file.name).toBe("file.txt");
			expect(file.parent.path).toBe("/path/to/");
		});

		test("throws when path does not start with a slash", () => {
			expect(() => create("")).toThrowError(InvalidPathError);
			expect(() => create("foo.txt")).toThrowError(InvalidPathError);

			expectError(
				() => create("foo.txt"),
				InvalidPathError,
				(error) => {
					expect(error.path).toBe("foo.txt");
					expect(error.reason).toBe("must start with a slash");
				},
			);
		});
	});

	describe("delete()", () => {
		test("deletes file from storage", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			expect(await file.exists()).toBe(true);
			await file.delete();
			expect(await file.exists()).toBe(false);
		});
	});

	describe("exists()", () => {
		test("returns false when file doesn't exist", async () => {
			const file = disk.file("test.txt");
			expect(await file.exists()).toBe(false);
		});

		test("returns true when file exists", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			expect(await file.exists()).toBe(true);
		});
	});

	describe("get()", () => {
		test("returns file content", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			const fetchResult = await file.get();
			expect(await fetchResult.response.text()).toBe("content");
			expect(fetchResult.mimeType).toBe("text/plain");
			expect(fetchResult.originalMimeType).toBe("text/plain");
			expect(fetchResult.size).toBe(7);
			expect(fetchResult.etag).toBeDefined();
			expect(fetchResult.response.headers.get("Content-Type")).toBe("text/plain");
		});

		test("throws when file doesn't exist", async () => {
			const file = disk.file("nonexistent.txt");
			expect(file.get()).rejects.toThrow(NotFoundError);

			await expectError(
				() => file.get(),
				NotFoundError,
				(error) => {
					expect(error.path).toBe("/nonexistent.txt");
				},
			);
		});

		test("infers missing MIME type from extension when supportsMimeTypes is false", async () => {
			const noMimeEndpoint = new MemoryEndpoint({
				supportsMimeTypes: false,
				initialFiles: {
					"test.png": { data: "content", mimeType: undefined },
				},
			});
			const noMimeDisk = new StorageDiskImpl("test", noMimeEndpoint, mockDispatcher());
			const file = noMimeDisk.file("test.png");
			const result = await file.get();
			expect(result.mimeType).toBe("image/png");
			expect(result.originalMimeType).toBeNull();
			expect(result.response.headers.get("Content-Type")).toBe("image/png");
		});

		test("overrides present MIME type from extension when supportsMimeTypes is false", async () => {
			const noMimeEndpoint = new MemoryEndpoint({
				supportsMimeTypes: false,
				initialFiles: {
					"test.png": { data: "content", mimeType: null },
				},
			});
			const noMimeDisk = new StorageDiskImpl("test", noMimeEndpoint, mockDispatcher());
			const file = noMimeDisk.file("test.png");
			const result = await file.get();
			expect(result.mimeType).toBe("image/png");
			expect(result.originalMimeType).toBeNull();
			expect(result.response.headers.get("Content-Type")).toBe("image/png");
		});

		test("infers missing MIME type from extension when supportsMimeTypes is true", async () => {
			const noMimeEndpoint = new MemoryEndpoint({
				supportsMimeTypes: true,
				initialFiles: {
					"test.png": { data: "content", mimeType: undefined },
				},
			});
			const noMimeDisk = new StorageDiskImpl("test", noMimeEndpoint, mockDispatcher());
			const file = noMimeDisk.file("test.png");
			const result = await file.get();
			expect(result.mimeType).toBe("image/png");
			expect(result.originalMimeType).toBeNull();
			expect(result.response.headers.get("Content-Type")).toBe("image/png");
		});

		test("does not override present MIME type from extension when supportsMimeTypes is true", async () => {
			const noMimeEndpoint = new MemoryEndpoint({
				supportsMimeTypes: true,
				initialFiles: {
					"test.png": { data: "content", mimeType: "image/jpeg" },
				},
			});
			const noMimeDisk = new StorageDiskImpl("test", noMimeEndpoint, mockDispatcher());
			const file = noMimeDisk.file("test.png");
			const result = await file.get();
			expect(result.mimeType).toBe("image/jpeg");
			expect(result.originalMimeType).toBe("image/jpeg");
			expect(result.response.headers.get("Content-Type")).toBe("image/jpeg");
		});

		test("preserves original Content-Type when supportsMimeTypes is true", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "custom/type" });
			const result = await file.get();
			expect(result.mimeType).toBe("custom/type");
			expect(result.originalMimeType).toBe("custom/type");
			expect(result.response.headers.get("Content-Type")).toBe("custom/type");
		});
	});

	describe("getText()", () => {
		test("returns file content as text", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "hello world", mimeType: "text/plain" });
			const text = await file.getText();
			expect(text).toBe("hello world");
		});
	});

	describe("getJson()", () => {
		test("returns file content parsed as JSON", async () => {
			const file = disk.file("data.json");
			const data = { foo: "bar", baz: 123 };
			await file.put({ data: JSON.stringify(data), mimeType: "application/json" });
			const json = await file.getJson();
			expect(json).toEqual(data);
		});
	});

	describe("getUint8Array()", () => {
		test("returns file content as Uint8Array", async () => {
			const file = disk.file("data.bin");
			const data = new Uint8Array([1, 2, 3, 4, 5]);
			await file.put({ data, mimeType: "application/octet-stream" });
			const binary = await file.getUint8Array();
			expect(binary).toEqual(data);
			expect(binary).toBeInstanceOf(Uint8Array);
		});
	});

	describe("info()", () => {
		test("returns file info when file exists", async () => {
			const file = disk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			const result = await file.info();
			expect(result).toMatchObject({
				size: 7,
				mimeType: "text/plain",
			});
			expect(result?.etag).toBeDefined();
		});

		test("returns null when file doesn't exist", async () => {
			const file = disk.file("nonexistent.txt");
			const result = await file.info();
			expect(result).toBeNull();
		});

		test("if endpoint throws FileNotFound we convert to null", async () => {
			const file = disk.file("nonexistent.txt");
			spyOn(endpoint, "getInfoSingle").mockImplementation(async () => {
				throw new NotFoundError("nonexistent.txt");
			});
			const result = await file.info();
			expect(result).toBeNull();
		});

		test("handles missing mime type", async () => {
			const endpoint = new MemoryEndpoint({
				supportsMimeTypes: false,
				initialFiles: {
					"test.png": { data: "content", mimeType: undefined },
				},
			});
			const disk = new StorageDiskImpl("test", endpoint, mockDispatcher());
			const result = await disk.file("test.bin").info();
			expect(result?.mimeType).toBeUndefined();
		});
	});

	describe("url()", () => {
		test("calls endpoint.getPublicDownloadUrl()", async () => {
			const spy = spyOn(endpoint, "getPublicDownloadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			const result = await file.url();
			expect(result).toBe("mocked-url");
			expect(spy).toHaveBeenCalledWith("/test.txt", { downloadAs: undefined });
		});

		test("passes downloadAs to endpoint.getPublicDownloadUrl()", async () => {
			const spy = spyOn(endpoint, "getPublicDownloadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			await file.url({ downloadAs: "custom.txt" });
			expect(spy).toHaveBeenCalledWith("/test.txt", { downloadAs: "custom.txt" });
		});
	});

	describe("signedUrl()", () => {
		test("calls endpoint.getSignedDownloadUrl() with 100y expiry by default", async () => {
			const spy = spyOn(endpoint, "getSignedDownloadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			const result = await file.signedUrl();
			expect(result).toBe("mocked-url");
			expect(spy).toHaveBeenCalledWith("/test.txt", {
				expires: new Date("2124-12-08T00:00:00.000Z"),
				downloadAs: undefined,
			});
		});

		test("accepts custom expires duration string", async () => {
			const spy = spyOn(endpoint, "getSignedDownloadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			await file.signedUrl({ expires: "1h" });
			expect(spy).toHaveBeenCalledWith("/test.txt", {
				expires: new Date("2025-01-01T01:00:00.000Z"),
				downloadAs: undefined,
			});
		});

		test("accepts custom expires Date", async () => {
			const spy = spyOn(endpoint, "getSignedDownloadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			const customDate = new Date("2025-06-15T12:30:00Z");
			await file.signedUrl({ expires: customDate });
			expect(spy).toHaveBeenCalledWith("/test.txt", {
				expires: customDate,
				downloadAs: undefined,
			});
		});

		test("passes downloadAs to endpoint.getSignedDownloadUrl()", async () => {
			const spy = spyOn(endpoint, "getSignedDownloadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			await file.signedUrl({ downloadAs: "custom.txt" });
			expect(spy).toHaveBeenCalledWith("/test.txt", {
				expires: expect.any(Date),
				downloadAs: "custom.txt",
			});
		});
	});

	describe("uploadUrl()", () => {
		test("calls endpoint.getTemporaryUploadUrl() with 100y expiry by default", async () => {
			const spy = spyOn(endpoint, "getTemporaryUploadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			const result = await file.uploadUrl();
			expect(result).toBe("mocked-url");
			expect(spy).toHaveBeenCalledWith("/test.txt", new Date("2124-12-08T00:00:00.000Z"));
		});

		test("accepts custom expires duration string", async () => {
			const spy = spyOn(endpoint, "getTemporaryUploadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			await file.uploadUrl({ expires: "1h" });
			expect(spy).toHaveBeenCalledWith("/test.txt", new Date("2025-01-01T01:00:00.000Z"));
		});

		test("accepts custom expires Date", async () => {
			const spy = spyOn(endpoint, "getTemporaryUploadUrl").mockResolvedValue("mocked-url");
			const file = disk.file("test.txt");
			const customDate = new Date("2025-06-15T12:30:00Z");
			await file.uploadUrl({ expires: customDate });
			expect(spy).toHaveBeenCalledWith("/test.txt", customDate);
		});
	});

	describe("put()", () => {
		test("works with explicit data and mimetype", async () => {
			const file = disk.file("dir/document.pdf");
			await file.put({ data: "content", mimeType: "application/pdf" });
			const fetchResult = await file.get();
			expect(fetchResult.response.headers.get("content-type")).toBe("application/pdf");
			expect(await fetchResult.response.text()).toBe("content");
		});

		test("infers mimeType from file path when not provided in object", async () => {
			const file = disk.file("dir/document.pdf");
			await file.put({ data: "content" });
			const info = await file.info();
			expect(info?.mimeType).toBe("application/pdf");
		});

		test("accepts direct string data and infers mimeType from path", async () => {
			const file = disk.file("dir/document.html");
			await file.put("<!DOCTYPE html><html></html>");
			const info = await file.info();
			expect(info?.mimeType).toBe("text/html");
		});

		test("accepts direct Blob data and infers mimeType from path", async () => {
			const file = disk.file("images/photo.png");
			const blob = new Blob(["binary data"]);
			await file.put(blob);
			const info = await file.info();
			expect(info?.mimeType).toBe("image/png");
		});

		test("accepts direct ArrayBuffer and infers mimeType from path", async () => {
			const file = disk.file("data/file.json");
			const buffer = new ArrayBuffer(8);
			await file.put(buffer);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/json");
		});

		test("accepts direct Uint8Array and infers mimeType from path", async () => {
			const file = disk.file("data/file.bin");
			const arr = new Uint8Array([1, 2, 3, 4]);
			await file.put(arr);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/octet-stream");
			expect(info?.originalMimeType).toBeNull();
		});

		test("falls back to application/octet-stream for unknown extensions", async () => {
			const file = disk.file("file.unknownext");
			await file.put("content");
			const info = await file.info();
			expect(info?.mimeType).toBe("application/octet-stream");
			expect(info?.originalMimeType).toBeNull();
		});

		test("falls back to application/octet-stream for files without extension", async () => {
			const file = disk.file("noextension");
			await file.put({ data: "content" });
			const info = await file.info();
			expect(info?.mimeType).toBe("application/octet-stream");
			expect(info?.originalMimeType).toBeNull();
		});

		test("extracts mimeType from File and uses file path", async () => {
			const file = disk.file("dir/document.pdf");
			const fileObj = new File(["content"], "document.pdf", { type: "application/pdf" });
			await file.put(fileObj);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/pdf");
		});

		test("infers from path when File has no type", async () => {
			const file = disk.file("dir/document.pdf");
			const fileObj = new File(["content"], "document.pdf", { type: "" });
			await file.put(fileObj);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/pdf");
		});

		test("extracts Content-Type from Request", async () => {
			const file = disk.file("uploads/document.pdf");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "data",
				headers: {
					"Content-Type": "application/pdf",
				},
			});
			await file.put(request);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/pdf");
		});

		test("infers from path when Request has no Content-Type", async () => {
			const file = disk.file("uploads/document.pdf");
			const request = new Request("http://example.com", {
				method: "POST",
				body: "data",
			});
			await file.put(request);
			const info = await file.info();
			expect(info?.mimeType).toBe("application/pdf");
		});
	});

	describe("copyTo()", () => {
		test("copies file on same disk", async () => {
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk.file("dest.txt");
			spyOnAll(endpoint);
			await source.copyTo(dest);
			expect(endpoint.readSingle).not.toHaveBeenCalled();
			expect(endpoint.copy).toHaveBeenCalledWith({
				source: "/source.txt",
				destination: "/dest.txt",
			});
			expect(await dest.exists()).toBe(true);
			const fetchResult = await dest.get();
			expect(await fetchResult.response.text()).toBe("hello");
		});

		test("copies file to different disk", async () => {
			const endpoint2 = new MemoryEndpoint({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2, mockDispatcher());
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk2.file("dest.txt");
			spyOnAll(endpoint);
			spyOnAll(endpoint2);
			await source.copyTo(dest);
			expect(endpoint.readSingle).toHaveBeenCalledWith("/source.txt");
			expect(endpoint.copy).not.toHaveBeenCalled();
			expect(endpoint2.writeSingle).toHaveBeenCalledWith({
				// we should use ReadableStream to stream data from one endpoint to another
				data: expect.any(ReadableStream),
				mimeType: "text/plain",
				path: "/dest.txt",
			});
			expect(endpoint2.copy).not.toHaveBeenCalled();
			expect(await dest.exists()).toBe(true);
			const fetchResult = await dest.get();
			expect(await fetchResult.response.text()).toBe("hello");
		});

		test("throws when source file doesn't exist on same-disk transfer", async () => {
			const source = disk.file("nonexistent.txt");
			const dest = disk.file("dest.txt");
			// Same-disk copy uses endpoint.copy() which may throw various errors
			// These get wrapped in StorageFailureError by withStorageErrors()
			expect(source.copyTo(dest)).rejects.toThrow();
		});

		test("throws when source file doesn't exist on cross-disk transfer", async () => {
			const endpoint2 = new MemoryEndpoint({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2, mockDispatcher());
			const source = disk.file("nonexistent.txt");
			const dest = disk2.file("dest.txt");
			expect(source.copyTo(dest)).rejects.toThrow(NotFoundError);

			await expectError(
				() => source.copyTo(dest),
				NotFoundError,
				(error) => {
					expect(error.path).toBe("/nonexistent.txt");
				},
			);
		});
	});

	describe("moveTo()", () => {
		test("moves file on same disk", async () => {
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk.file("dest.txt");
			spyOnAll(endpoint);
			await source.moveTo(dest);
			expect(endpoint.move).toHaveBeenCalledWith({
				source: "/source.txt",
				destination: "/dest.txt",
			});
			expect(endpoint.copy).not.toHaveBeenCalled();
			expect(endpoint.readSingle).not.toHaveBeenCalled();
			expect(await dest.exists()).toBe(true);
			const fetchResult = await dest.get();
			expect(await fetchResult.response.text()).toBe("hello");
			expect(await source.exists()).toBe(false);
		});

		test("moves file to different disk", async () => {
			const endpoint2 = new MemoryEndpoint({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2, mockDispatcher());
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk2.file("dest.txt");
			spyOnAll(endpoint);
			spyOnAll(endpoint2);
			await source.moveTo(dest);
			expect(endpoint.move).not.toHaveBeenCalled();
			expect(endpoint.copy).not.toHaveBeenCalled();
			expect(endpoint.readSingle).toHaveBeenCalledWith("/source.txt");
			expect(endpoint2.writeSingle).toHaveBeenCalledWith({
				// should use streaming
				data: expect.any(ReadableStream),
				mimeType: "text/plain",
				path: "/dest.txt",
			});
			expect(endpoint.deleteSingle).toHaveBeenCalledWith("/source.txt");
			const fetchResult = await dest.get();
			expect(await fetchResult.response.text()).toBe("hello");
			expect(fetchResult.response.headers.get("content-type")).toBe("text/plain");
			expect(await source.exists()).toBe(false);
		});

		test("throws when source file doesn't exist on same-disk move", async () => {
			const source = disk.file("nonexistent.txt");
			const dest = disk.file("dest.txt");
			spyOn(endpoint, "move").mockImplementation(async () => {
				throw new Error("Source file not found: /nonexistent.txt");
			});
			expect(source.moveTo(dest)).rejects.toThrow("Source file not found");
		});

		test("throws when source file doesn't exist on cross-disk move", async () => {
			const endpoint2 = new MemoryEndpoint({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2, mockDispatcher());
			const source = disk.file("nonexistent.txt");
			const dest = disk2.file("dest.txt");
			expect(source.moveTo(dest)).rejects.toThrow(NotFoundError);
		});

		test("does not delete source if cross-disk copy fails", async () => {
			const endpoint2 = new MemoryEndpoint({});
			const disk2 = new StorageDiskImpl("disk2", endpoint2, mockDispatcher());
			const source = disk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			const dest = disk2.file("dest.txt");
			spyOn(endpoint2, "writeSingle").mockImplementation(async () => {
				throw new Error("Write failed");
			});
			spyOn(endpoint, "deleteSingle");
			expect(source.moveTo(dest)).rejects.toThrow("Write failed");
			expect(endpoint.deleteSingle).not.toHaveBeenCalled();
			expect(await source.exists()).toBe(true);
		});
	});

	describe("toString()", () => {
		test("returns [StorageFileImpl endpoint://path]", () => {
			const endpoint = new MemoryEndpoint({});
			const file = create("/path/to/file.txt", endpoint);
			expect(file.toString()).toBe("[StorageFileImpl memory://path/to/file.txt]");
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

		test("delete() dispatches file:delete events once", async () => {
			const file = eventDisk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			eventDispatcher.clear();

			await file.delete();

			const startEvent = new FileDeletingEvent(eventDisk, "/test.txt");
			const endEvent = new FileDeletedEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("exists() dispatches file:existence-check events once", async () => {
			const file = eventDisk.file("test.txt");

			await file.exists();

			const startEvent = new FileExistenceCheckingEvent(eventDisk, "/test.txt");
			const endEvent = new FileExistenceCheckedEvent(startEvent, false);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("get() dispatches file:fetch events once", async () => {
			const file = eventDisk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			eventDispatcher.clear();

			const fetchResult = await file.get();

			const startEvent = new FileReadingEvent(eventDisk, "/test.txt");
			const endEvent = new FileReadEvent(startEvent, fetchResult.response);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("info() dispatches file:info-retrieve events once", async () => {
			const file = eventDisk.file("test.txt");
			await file.put({ data: "content", mimeType: "text/plain" });
			eventDispatcher.clear();

			const info = await file.info();

			const startEvent = new FileInfoRetrievingEvent(eventDisk, "/test.txt");
			const endEvent = new FileInfoRetrievedEvent(startEvent, info);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("url() dispatches file:url-generate events once", async () => {
			spyOn(endpoint, "getPublicDownloadUrl").mockResolvedValue("mocked-url");
			const file = eventDisk.file("test.txt");

			const url = await file.url();

			const startEvent = new FileUrlGeneratingEvent(eventDisk, "/test.txt", "url", {});
			const endEvent = new FileUrlGeneratedEvent(startEvent, url);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("signedUrl() dispatches file:url-generate events once", async () => {
			spyOn(endpoint, "getSignedDownloadUrl").mockResolvedValue("mocked-url");
			const file = eventDisk.file("test.txt");

			const url = await file.signedUrl({ expires: "1d" });

			const startEvent = new FileUrlGeneratingEvent(eventDisk, "/test.txt", "signed", {
				expires: "1d",
			});
			const endEvent = new FileUrlGeneratedEvent(startEvent, url);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("uploadUrl() dispatches file:url-generate events once", async () => {
			spyOn(endpoint, "getTemporaryUploadUrl").mockResolvedValue("mocked-url");
			const file = eventDisk.file("test.txt");

			const url = await file.uploadUrl({ expires: "2d" });

			const startEvent = new FileUrlGeneratingEvent(eventDisk, "/test.txt", "upload", {
				expires: "2d",
			});
			const endEvent = new FileUrlGeneratedEvent(startEvent, url);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("put() dispatches file:write events once", async () => {
			const file = eventDisk.file("test.txt");

			const data = "content";
			await file.put({ data, mimeType: "text/plain" });

			const startEvent = new FileWritingEvent(eventDisk, "/test.txt", data, "text/plain");
			const endEvent = new FileWrittenEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("copyTo() same disk dispatches file:copy events once", async () => {
			const source = eventDisk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			eventDispatcher.clear();

			const dest = eventDisk.file("dest.txt");
			await source.copyTo(dest);

			const startEvent = new FileCopyingEvent(eventDisk, "/source.txt", "event-test", "/dest.txt");
			const endEvent = new FileCopiedEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});

		test("moveTo() same disk dispatches file:move events once", async () => {
			const source = eventDisk.file("source.txt");
			await source.put({ data: "hello", mimeType: "text/plain" });
			eventDispatcher.clear();

			const dest = eventDisk.file("dest.txt");
			await source.moveTo(dest);

			const startEvent = new FileMovingEvent(eventDisk, "/source.txt", "event-test", "/dest.txt");
			const endEvent = new FileMovedEvent(startEvent);
			eventDispatcher.expectEvents([startEvent, endEvent]);
		});
	});
});
