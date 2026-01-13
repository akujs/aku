import { AkuEvent } from "../core/core-events.ts";
import type {
	StorageData,
	StorageDisk,
	StorageFileInfo,
	StorageFileSignedUrlOptions,
} from "./contracts/Storage.ts";
import type { StorageError } from "./storage-errors.ts";

/**
 * Operation types for storage events
 */
export type StorageOperationType =
	| "file:read"
	| "file:existence-check"
	| "file:info-retrieve"
	| "file:url-generate"
	| "file:write"
	| "file:delete"
	| "file:copy"
	| "file:move"
	| "directory:existence-check"
	| "directory:list"
	| "directory:delete";

/**
 * Base class for all storage events
 */
export abstract class StorageEvent extends AkuEvent {
	abstract readonly type: StorageOperationType;
	readonly disk: StorageDisk;
	readonly path: string;

	constructor(disk: StorageDisk, path: string) {
		super();
		this.disk = disk;
		this.path = path;
	}

	protected override getToStringExtra(): string {
		return `${this.disk.name}:${this.path}`;
	}
}

/**
 * Base class for all "starting" operation events
 */
export abstract class StorageOperationStartingEvent extends StorageEvent {
	readonly phase = "start" as const;

	/**
	 * High-resolution timestamp from `performance.now()` when the operation started.
	 */
	public readonly startTimestamp: number = performance.now();
}

/**
 * Base class for all "completed" operation events
 */
export abstract class StorageOperationCompletedEvent extends StorageEvent {
	readonly phase = "complete" as const;
	public readonly timeTakenMs: number;

	constructor(startEvent: StorageOperationStartingEvent) {
		super(startEvent.disk, startEvent.path);
		this.timeTakenMs = performance.now() - startEvent.startTimestamp;
	}
}

/**
 * Event dispatched when any storage operation fails
 */
export class StorageOperationFailedEvent extends StorageEvent {
	readonly phase = "fail" as const;
	public readonly timeTakenMs: number;
	public readonly type: StorageOperationType;
	readonly startEvent: StorageOperationStartingEvent;
	readonly error: StorageError;

	constructor(startEvent: StorageOperationStartingEvent, error: StorageError) {
		super(startEvent.disk, startEvent.path);
		this.startEvent = startEvent;
		this.error = error;
		this.timeTakenMs = performance.now() - startEvent.startTimestamp;
		this.type = startEvent.type;
	}
}

/** Dispatched when a file read operation starts. */
export class FileReadingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:read" as const;
}

/** Dispatched when a file has been successfully read. */
export class FileReadEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:read" as const;
	readonly #response: Response;
	#headers?: Headers;

	constructor(startEvent: FileReadingEvent, response: Response) {
		super(startEvent);
		this.#response = response;
	}

	get status(): number {
		return this.#response.status;
	}

	get headers(): Headers | undefined {
		if (!this.#headers) {
			this.#headers = new Headers(this.#response.headers);
		}
		return this.#headers;
	}

	/**
	 * Get a clone of the response so that you can access the response body.
	 */
	cloneResponse(): Response {
		return this.#response.clone() as Response;
	}
}

/** Dispatched when checking if a file exists. */
export class FileExistenceCheckingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:existence-check" as const;
}

/** Dispatched when file existence check completes. */
export class FileExistenceCheckedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:existence-check" as const;
	readonly exists: boolean;

	constructor(startEvent: FileExistenceCheckingEvent, exists: boolean) {
		super(startEvent);
		this.exists = exists;
	}
}

/** Dispatched when retrieving file metadata. */
export class FileInfoRetrievingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:info-retrieve" as const;
}

/** Dispatched when file metadata has been retrieved. */
export class FileInfoRetrievedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:info-retrieve" as const;
	readonly info: StorageFileInfo | null;

	constructor(startEvent: FileInfoRetrievingEvent, info: StorageFileInfo | null) {
		super(startEvent);
		this.info = info;
	}
}

/** Dispatched when generating a URL for a file. */
export class FileUrlGeneratingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:url-generate" as const;
	readonly urlType: "url" | "signed" | "upload";
	readonly options: StorageFileSignedUrlOptions;

	constructor(
		disk: StorageDisk,
		path: string,
		urlType: "url" | "signed" | "upload",
		options: StorageFileSignedUrlOptions,
	) {
		super(disk, path);
		this.urlType = urlType;
		this.options = options;
	}
}

/** Dispatched when a file URL has been generated. */
export class FileUrlGeneratedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:url-generate" as const;

	readonly #startEvent: FileUrlGeneratingEvent;
	readonly url: string;

	constructor(startEvent: FileUrlGeneratingEvent, url: string) {
		super(startEvent);
		this.#startEvent = startEvent;
		this.url = url;
	}

	get urlType(): "url" | "signed" | "upload" {
		return this.#startEvent.urlType;
	}

	get options(): StorageFileSignedUrlOptions {
		return this.#startEvent.options;
	}
}

/** Dispatched when a file write operation starts. */
export class FileWritingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:write" as const;
	readonly data: StorageData;
	readonly mimeType: string | null;

	constructor(disk: StorageDisk, path: string, data: StorageData, mimeType: string | null) {
		super(disk, path);
		this.data = data;
		this.mimeType = mimeType;
	}
}

/** Dispatched when a file has been successfully written. */
export class FileWrittenEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:write" as const;

	readonly #startEvent: FileWritingEvent;

	constructor(startEvent: FileWritingEvent) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get data(): StorageData {
		return this.#startEvent.data;
	}

	get mimeType(): string | null {
		return this.#startEvent.mimeType;
	}
}

/** Dispatched when a file deletion starts. */
export class FileDeletingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:delete" as const;
}

/** Dispatched when a file has been successfully deleted. */
export class FileDeletedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:delete" as const;
}

/** Dispatched when a file copy operation starts. */
export class FileCopyingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:copy" as const;
	readonly destinationDiskName: string;
	readonly destinationPath: string;

	constructor(
		disk: StorageDisk,
		path: string,
		destinationDiskName: string,
		destinationPath: string,
	) {
		super(disk, path);
		this.destinationDiskName = destinationDiskName;
		this.destinationPath = destinationPath;
	}
}

/** Dispatched when a file has been successfully copied. */
export class FileCopiedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:copy" as const;

	readonly #startEvent: FileCopyingEvent;

	constructor(startEvent: FileCopyingEvent) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get destinationDiskName(): string {
		return this.#startEvent.destinationDiskName;
	}

	get destinationPath(): string {
		return this.#startEvent.destinationPath;
	}
}

/** Dispatched when a file move operation starts. */
export class FileMovingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:move" as const;
	readonly destinationDiskName: string;
	readonly destinationPath: string;

	constructor(
		disk: StorageDisk,
		path: string,
		destinationDiskName: string,
		destinationPath: string,
	) {
		super(disk, path);
		this.destinationDiskName = destinationDiskName;
		this.destinationPath = destinationPath;
	}
}

/** Dispatched when a file has been successfully moved. */
export class FileMovedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:move" as const;

	readonly #startEvent: FileMovingEvent;

	constructor(startEvent: FileMovingEvent) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get destinationDiskName(): string {
		return this.#startEvent.destinationDiskName;
	}

	get destinationPath(): string {
		return this.#startEvent.destinationPath;
	}
}

/** Dispatched when checking if a directory exists. */
export class DirectoryExistenceCheckingEvent extends StorageOperationStartingEvent {
	public readonly type = "directory:existence-check" as const;
}

/** Dispatched when directory existence check completes. */
export class DirectoryExistenceCheckedEvent extends StorageOperationCompletedEvent {
	public readonly type = "directory:existence-check" as const;
	readonly exists: boolean;

	constructor(startEvent: DirectoryExistenceCheckingEvent, exists: boolean) {
		super(startEvent);
		this.exists = exists;
	}
}

/** Dispatched when a directory listing operation starts. */
export class DirectoryListingEvent extends StorageOperationStartingEvent {
	public readonly type = "directory:list" as const;
	readonly list: "files" | "directories" | "all";
	readonly recursive: boolean;

	constructor(
		disk: StorageDisk,
		path: string,
		list: "files" | "directories" | "all",
		recursive: boolean,
	) {
		super(disk, path);
		this.list = list;
		this.recursive = recursive;
	}
}

/** Dispatched when a directory has been successfully listed. */
export class DirectoryListedEvent extends StorageOperationCompletedEvent {
	public readonly type = "directory:list" as const;
	readonly #startEvent: DirectoryListingEvent;
	readonly entryCount: number;

	constructor(startEvent: DirectoryListingEvent, entryCount: number) {
		super(startEvent);
		this.#startEvent = startEvent;
		this.entryCount = entryCount;
	}

	get list(): "files" | "directories" | "all" {
		return this.#startEvent.list;
	}

	get recursive(): boolean {
		return this.#startEvent.recursive;
	}
}

/** Dispatched when a directory deletion starts. */
export class DirectoryDeletingEvent extends StorageOperationStartingEvent {
	public readonly type = "directory:delete" as const;
}

/** Dispatched when a directory has been successfully deleted. */
export class DirectoryDeletedEvent extends StorageOperationCompletedEvent {
	public readonly type = "directory:delete" as const;
}
