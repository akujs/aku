import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { parseAttributeHeader } from "../helpers/headers/attributes.ts";
import { arrayFromAsync, BaseClass } from "../utils.ts";
import type {
	StorageData,
	StorageDirectory,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
	StorageFilePutPayload,
} from "./contracts/Storage.ts";
import { createFileName, mimeTypeFromFileName, sanitiseName } from "./file-names.ts";
import { posix } from "./path-operations.ts";
import { StorageFileImpl } from "./StorageFileImpl.ts";
import { InvalidPathError } from "./storage-errors.ts";
import {
	DirectoryDeletedEvent,
	DirectoryDeletingEvent,
	DirectoryExistenceCheckedEvent,
	DirectoryExistenceCheckingEvent,
	DirectoryListedEvent,
	DirectoryListingEvent,
} from "./storage-events.ts";
import { storageOperation } from "./storage-operation.ts";

export class StorageDirectoryImpl extends BaseClass implements StorageDirectory {
	readonly type = "directory" as const;
	readonly disk: StorageDisk;
	readonly path: string;
	readonly #endpoint: StorageEndpoint;
	readonly #dispatcher: Dispatcher;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string, dispatcher: Dispatcher) {
		super();
		this.disk = disk;
		this.#endpoint = endpoint;
		this.#dispatcher = dispatcher;
		if (!path.startsWith("/") || !path.endsWith("/")) {
			throw new InvalidPathError(path, "directory paths must start and end with a slash");
		}
		this.path = path;
	}

	async exists(): Promise<boolean> {
		return await storageOperation(
			"directory:existence-check",
			() => this.#endpoint.existsAnyUnderPrefix(this.path),
			() => new DirectoryExistenceCheckingEvent(this.disk, this.path),
			(start, exists) => new DirectoryExistenceCheckedEvent(start, exists),
			this.#dispatcher,
			{ onNotFound: false },
		);
	}

	async list(): Promise<Array<StorageFile | StorageDirectory>> {
		return arrayFromAsync(this.listStreaming());
	}

	listStreaming(): AsyncGenerator<StorageFile | StorageDirectory, void> {
		return storageOperation(
			"directory:list",
			this.#listStreamingGenerator.bind(this),
			() => new DirectoryListingEvent(this.disk, this.path, "all", false),
			(start, count) => new DirectoryListedEvent(start, count),
			this.#dispatcher,
			{ onNotFound: emptyGenerator() },
		);
	}

	async *#listStreamingGenerator(): AsyncGenerator<StorageFile | StorageDirectory, void> {
		for await (const path of this.#endpoint.listEntries(this.path)) {
			yield this.#createEntry(path);
		}
	}

	#createEntry(relativePath: string): StorageFile | StorageDirectory {
		// Convert relative path to absolute path
		const absolutePath = `${this.path}${relativePath}`;
		if (relativePath.endsWith("/")) {
			return new StorageDirectoryImpl(this.disk, this.#endpoint, absolutePath, this.#dispatcher);
		}
		return new StorageFileImpl(this.disk, this.#endpoint, absolutePath, this.#dispatcher);
	}

	async listFiles(options?: { recursive?: boolean }): Promise<Array<StorageFile>> {
		return arrayFromAsync(this.listFilesStreaming(options));
	}

	listFilesStreaming(options?: { recursive?: boolean }): AsyncGenerator<StorageFile, void> {
		const recursive = options?.recursive ?? false;
		return storageOperation(
			"directory:list",
			this.#filesStreamingGenerator.bind(this, recursive),
			() => new DirectoryListingEvent(this.disk, this.path, "files", recursive),
			(start, count) => new DirectoryListedEvent(start, count),
			this.#dispatcher,
			{ onNotFound: emptyGenerator() },
		);
	}

	async *#filesStreamingGenerator(recursive: boolean): AsyncGenerator<StorageFile, void> {
		if (recursive) {
			// Use recursive listing
			for await (const path of this.#endpoint.listFilesRecursive(this.path)) {
				const entry = this.#createEntry(path);
				if (entry instanceof StorageFileImpl) {
					yield entry;
				}
			}
		} else {
			// Use immediate listing, filter to files only
			for await (const path of this.#endpoint.listEntries(this.path)) {
				const entry = this.#createEntry(path);
				if (entry instanceof StorageFileImpl) {
					yield entry;
				}
			}
		}
	}

	async listDirectories(): Promise<Array<StorageDirectory>> {
		return arrayFromAsync(this.listDirectoriesStreaming());
	}

	listDirectoriesStreaming(): AsyncGenerator<StorageDirectory, void> {
		return storageOperation(
			"directory:list",
			this.#directoriesStreamingGenerator.bind(this),
			() => new DirectoryListingEvent(this.disk, this.path, "directories", false),
			(start, count) => new DirectoryListedEvent(start, count),
			this.#dispatcher,
			{ onNotFound: emptyGenerator() },
		);
	}

	async *#directoriesStreamingGenerator(): AsyncGenerator<StorageDirectory, void> {
		for await (const path of this.#endpoint.listEntries(this.path)) {
			const entry = this.#createEntry(path);
			if (entry instanceof StorageDirectoryImpl) {
				yield entry;
			}
		}
	}

	async deleteAll(): Promise<void> {
		await storageOperation(
			"directory:delete",
			() => this.#endpoint.deleteAllUnderPrefix(this.path),
			() => new DirectoryDeletingEvent(this.disk, this.path),
			(start) => new DirectoryDeletedEvent(start),
			this.#dispatcher,
			{ onNotFound: undefined },
		);
	}

	directory(path: string, options?: { onInvalid?: "convert" | "throw" }): StorageDirectory {
		const parts = this.#splitAndSanitisePath(path, options?.onInvalid);
		// Return self if path is empty or only contains empty segments
		if (parts.every((p) => p === "")) {
			return this;
		}

		let fullPath = posix.normalize(posix.join(this.path, parts.join("/")));

		if (!fullPath.endsWith("/")) {
			fullPath += "/";
		}

		return new StorageDirectoryImpl(this.disk, this.#endpoint, fullPath, this.#dispatcher);
	}

	file(path: string, options?: { onInvalid?: "convert" | "throw" }): StorageFile {
		if (path.endsWith("/") || path.endsWith("\\") || path === "") {
			throw new InvalidPathError(path, "file name cannot be empty");
		}

		const parts = this.#splitAndSanitisePath(path, options?.onInvalid);

		const fullPath = posix.normalize(posix.join(this.path, parts.join("/")));

		return new StorageFileImpl(this.disk, this.#endpoint, fullPath, this.#dispatcher);
	}

	#splitAndSanitisePath(path: string, onInvalid: "convert" | "throw" = "convert"): string[] {
		path = path.trim().replaceAll(/\s/g, "_");
		const segments = path.replaceAll(/^[\\/]+|[\\/]$/g, "").split(/[\\/]+/g);

		return segments.map((segment) => {
			const sanitisedName = sanitiseName(segment, this.#endpoint.invalidNameChars);
			if (onInvalid === "throw" && sanitisedName !== segment) {
				const fullPath = posix.join(this.path, path);
				throw InvalidPathError.forInvalidCharacters(fullPath, this.#endpoint);
			}
			return sanitisedName;
		});
	}

	async putFile(
		payload: (StorageFilePutPayload & { suggestedName?: string | undefined }) | File | Request,
	): Promise<StorageFile> {
		let data: StorageData | null | undefined;
		let mimeType: string | null | undefined;
		let suggestedName: string | null | undefined;

		if (payload instanceof File) {
			data = payload;
			mimeType = payload.type;
			suggestedName = payload.name?.trim();
		} else if (payload instanceof Request) {
			data = payload.body;
			mimeType = payload.headers.get("Content-Type");

			suggestedName = payload.headers.get("X-File-Name")?.trim();
			if (!suggestedName) {
				const contentDisposition = payload.headers.get("Content-Disposition");
				if (contentDisposition) {
					try {
						suggestedName = parseAttributeHeader(contentDisposition).attributes.filename;
					} catch {}
				}
			}
		} else {
			data = payload.data;
			mimeType = payload.mimeType;
			suggestedName = payload.suggestedName;
		}

		mimeType ||= mimeTypeFromFileName(suggestedName ?? "");

		const file = this.file(
			sanitiseName(
				createFileName(suggestedName, mimeType, this.#endpoint.supportsMimeTypes),
				this.#endpoint.invalidNameChars,
			),
		);

		if (data != null) {
			await file.put({
				data,
				mimeType: mimeType ?? undefined,
			});
		}

		return file;
	}

	protected override getToStringExtra(): string | undefined {
		return `${this.#endpoint.name}:/${this.path}`;
	}
}

const emptyGenerator = async function* () {};
