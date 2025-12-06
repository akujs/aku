import { afterEach, describe, expect, test } from "bun:test";
import { mockDispatcher } from "../test-utils/internal-mocks.bun.ts";
import { mockCurrentTime, resetMockTime } from "../testing/mock-time.ts";
import type { StorageDisk } from "./contracts/Storage.ts";
import { InvalidPathError, StorageUnknownError } from "./storage-errors.ts";
import {
	FileDeletedEvent,
	FileDeletingEvent,
	FileReadingEvent,
	FileWritingEvent,
	FileWrittenEvent,
} from "./storage-events.ts";
import { storageOperation } from "./storage-operation.ts";

describe(storageOperation, () => {
	afterEach(() => {
		resetMockTime();
	});

	test("returns result when async function succeeds", async () => {
		const mockDisk: StorageDisk = { name: "test-disk" } as StorageDisk;
		const dispatcher = mockDispatcher();

		const result = await storageOperation(
			"file:read",
			async () => "async success",
			() => new FileReadingEvent(mockDisk, "/test.txt"),
			(start) => new FileDeletedEvent(start),
			dispatcher,
			{ onNotFound: "throw" },
		);

		expect(result).toBe("async success");
	});

	test("preserves StorageError instances unchanged", async () => {
		const mockDisk: StorageDisk = { name: "test-disk" } as StorageDisk;
		const dispatcher = mockDispatcher();
		const originalError = new InvalidPathError("/bad", "test reason");

		try {
			await storageOperation(
				"file:delete",
				async () => {
					throw originalError;
				},
				() => new FileDeletingEvent(mockDisk, "/test.txt"),
				(start) => new FileDeletedEvent(start),
				dispatcher,
				{ onNotFound: "throw" },
			);
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBe(originalError);
			expect(error).toBeInstanceOf(InvalidPathError);
		}
	});

	test("wraps non-StorageError Error in StorageUnknownError", async () => {
		const mockDisk: StorageDisk = { name: "test-disk" } as StorageDisk;
		const dispatcher = mockDispatcher();
		const originalError = new Error("Something went wrong");

		try {
			await storageOperation(
				"file:write",
				async () => {
					throw originalError;
				},
				() => new FileWritingEvent(mockDisk, "/test.txt", "test data", "text/plain"),
				(start) => new FileWrittenEvent(start),
				dispatcher,
				{ onNotFound: "throw" },
			);
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(StorageUnknownError);
			const storageError = error as StorageUnknownError;
			expect(storageError.operation).toBe("file:write");
			expect(storageError.cause).toBe(originalError);
		}
	});

	test("wraps non-Error throws in StorageUnknownError", async () => {
		const mockDisk: StorageDisk = { name: "test-disk" } as StorageDisk;
		const dispatcher = mockDispatcher();

		try {
			await storageOperation(
				"file:delete",
				async () => {
					throw "string error";
				},
				() => new FileDeletingEvent(mockDisk, "/test.txt"),
				(start) => new FileDeletedEvent(start),
				dispatcher,
				{ onNotFound: "throw" },
			);
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(StorageUnknownError);
			const storageError = error as StorageUnknownError;
			expect(storageError.operation).toBe("file:delete");
			expect(storageError.cause).toBeInstanceOf(Error);
			expect(storageError.cause?.message).toBe("string error");
		}
	});

	test("throws error when event type does not match operation type", async () => {
		const mockDisk: StorageDisk = { name: "test-disk" } as StorageDisk;
		const dispatcher = mockDispatcher();

		try {
			await storageOperation(
				"file:delete",
				async () => "success",
				() => new FileReadingEvent(mockDisk, "/test.txt"), // Wrong event type
				(start) => new FileDeletedEvent(start),
				dispatcher,
				{ onNotFound: "throw" },
			);
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toContain("Event type mismatch");
			expect((error as Error).message).toContain("file:delete");
			expect((error as Error).message).toContain("file:read");
		}
	});

	test("calculates timeTakenMs correctly", async () => {
		const mockDisk: StorageDisk = { name: "test-disk" } as StorageDisk;
		const dispatcher = mockDispatcher();

		// Mock time to control timestamps
		mockCurrentTime(2000);

		let completedEvent: FileDeletedEvent | undefined;

		await storageOperation(
			"file:delete",
			async () => {
				// Advance time by 250ms during operation
				mockCurrentTime(2250);
				return "success";
			},
			() => new FileDeletingEvent(mockDisk, "/test.txt"),
			(start) => {
				completedEvent = new FileDeletedEvent(start);
				return completedEvent;
			},
			dispatcher,
			{ onNotFound: "throw" },
		);

		expect(completedEvent).toBeDefined();
		expect(completedEvent!.timeTakenMs).toBe(250);
	});

	test("handles async generator that throws", async () => {
		const mockDisk: StorageDisk = { name: "test-disk" } as StorageDisk;
		const dispatcher = mockDispatcher();
		const originalError = new Error("Generator error after yield");

		const generator = storageOperation(
			"file:delete",
			async function* () {
				yield "first";
				throw originalError;
			},
			() => new FileDeletingEvent(mockDisk, "/test.txt"),
			(start) => new FileDeletedEvent(start),
			dispatcher,
			{ onNotFound: "throw" },
		);

		const results: string[] = [];
		try {
			for await (const value of generator) {
				results.push(value);
			}
			throw new Error("Should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(StorageUnknownError);
			const storageError = error as StorageUnknownError;
			expect(storageError.operation).toBe("file:delete");
			expect(storageError.cause).toBe(originalError);
		}

		expect(results).toEqual(["first"]);
	});
});
