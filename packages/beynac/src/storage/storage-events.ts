import { BeynacEvent } from "../core/core-events.ts";
import type { StorageData, StorageDisk, StorageFileInfo } from "./contracts/Storage.ts";
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
export abstract class StorageEvent extends BeynacEvent {
	abstract readonly type: StorageOperationType;

	constructor(
		public readonly disk: StorageDisk,
		public readonly path: string,
	) {
		super();
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
	public readonly startTimestamp: number = Date.now();
}

/**
 * Base class for all "completed" operation events
 */
export abstract class StorageOperationCompletedEvent extends StorageEvent {
	readonly phase = "complete" as const;
	public readonly timeTakenMs: number;

	constructor(startEvent: StorageOperationStartingEvent) {
		super(startEvent.disk, startEvent.path);
		this.timeTakenMs = Date.now() - startEvent.startTimestamp;
	}
}

/**
 * Event dispatched when any storage operation fails
 */
export class StorageOperationFailedEvent extends StorageEvent {
	readonly phase = "fail" as const;
	public readonly timeTakenMs: number;
	public readonly type: StorageOperationType;

	constructor(
		public readonly startEvent: StorageOperationStartingEvent,
		public readonly error: StorageError,
	) {
		super(startEvent.disk, startEvent.path);
		this.timeTakenMs = Date.now() - startEvent.startTimestamp;
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

	constructor(
		startEvent: FileExistenceCheckingEvent,
		public readonly exists: boolean,
	) {
		super(startEvent);
	}
}

/** Dispatched when retrieving file metadata. */
export class FileInfoRetrievingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:info-retrieve" as const;
}

/** Dispatched when file metadata has been retrieved. */
export class FileInfoRetrievedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:info-retrieve" as const;

	constructor(
		startEvent: FileInfoRetrievingEvent,
		public readonly info: StorageFileInfo | null,
	) {
		super(startEvent);
	}
}

/** Dispatched when generating a URL for a file. */
export class FileUrlGeneratingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:url-generate" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly urlType: "url" | "signed" | "upload",
		public readonly options?: {
			expires?: string | Date;
			downloadAs?: string;
		},
	) {
		super(disk, path);
	}
}

/** Dispatched when a file URL has been generated. */
export class FileUrlGeneratedEvent extends StorageOperationCompletedEvent {
	public readonly type = "file:url-generate" as const;

	readonly #startEvent: FileUrlGeneratingEvent;

	constructor(
		startEvent: FileUrlGeneratingEvent,
		public readonly url: string,
	) {
		super(startEvent);
		this.#startEvent = startEvent;
	}

	get urlType(): "url" | "signed" | "upload" {
		return this.#startEvent.urlType;
	}

	get options():
		| {
				expires?: string | Date;
				downloadAs?: string;
		  }
		| undefined {
		return this.#startEvent.options;
	}
}

/** Dispatched when a file write operation starts. */
export class FileWritingEvent extends StorageOperationStartingEvent {
	public readonly type = "file:write" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly data: StorageData,
		public readonly mimeType: string | null,
	) {
		super(disk, path);
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
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly destinationDiskName: string,
		public readonly destinationPath: string,
	) {
		super(disk, path);
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
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly destinationDiskName: string,
		public readonly destinationPath: string,
	) {
		super(disk, path);
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

	constructor(
		startEvent: DirectoryExistenceCheckingEvent,
		public readonly exists: boolean,
	) {
		super(startEvent);
	}
}

/** Dispatched when a directory listing operation starts. */
export class DirectoryListingEvent extends StorageOperationStartingEvent {
	public readonly type = "directory:list" as const;
	constructor(
		disk: StorageDisk,
		path: string,
		public readonly list: "files" | "directories" | "all",
		public readonly recursive: boolean,
	) {
		super(disk, path);
	}
}

/** Dispatched when a directory has been successfully listed. */
export class DirectoryListedEvent extends StorageOperationCompletedEvent {
	public readonly type = "directory:list" as const;
	readonly #startEvent: DirectoryListingEvent;

	constructor(
		startEvent: DirectoryListingEvent,
		public readonly entryCount: number,
	) {
		super(startEvent);
		this.#startEvent = startEvent;
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
