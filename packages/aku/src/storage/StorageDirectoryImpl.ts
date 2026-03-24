import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { arrayFromAsync, BaseClass } from "../utils.ts";
import type { StorageDirectory, StorageEndpoint, StorageFile } from "./contracts/Storage.ts";
import type { StorageDiskImpl } from "./StorageDiskImpl.ts";
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
	readonly disk: StorageDiskImpl;
	readonly path: string;
	readonly name: string;
	readonly #endpoint: StorageEndpoint;
	readonly #dispatcher: Dispatcher;

	constructor(
		disk: StorageDiskImpl,
		endpoint: StorageEndpoint,
		path: string,
		dispatcher: Dispatcher,
	) {
		super();
		if (!path.startsWith("/") || !path.endsWith("/")) {
			throw new InvalidPathError(path, "directory paths must start and end with a slash");
		}
		this.disk = disk;
		this.#endpoint = endpoint;
		this.#dispatcher = dispatcher;
		this.path = path;
		const withoutTrailingSlash = path.slice(0, -1);
		this.name = withoutTrailingSlash.substring(withoutTrailingSlash.lastIndexOf("/") + 1);
	}

	get parent(): StorageDirectory | null {
		if (this.path === "/") {
			return null;
		}
		const withoutTrailing = this.path.slice(0, -1);
		const parentPath = withoutTrailing.substring(0, withoutTrailing.lastIndexOf("/") + 1);
		return this.disk.getOrCreateDirectory(parentPath);
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
			return this.disk.getOrCreateDirectory(absolutePath);
		}
		return this.disk.getOrCreateFile(absolutePath);
	}

	async listFiles(options?: { recursive?: boolean | undefined }): Promise<Array<StorageFile>> {
		return arrayFromAsync(this.listFilesStreaming(options));
	}

	listFilesStreaming(options?: {
		recursive?: boolean | undefined;
	}): AsyncGenerator<StorageFile, void> {
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
				if (entry.type === "file") {
					yield entry;
				}
			}
		} else {
			// Use immediate listing, filter to files only
			for await (const path of this.#endpoint.listEntries(this.path)) {
				const entry = this.#createEntry(path);
				if (entry.type === "file") {
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
			if (entry.type === "directory") {
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

	directory(name: string): StorageDirectory {
		if (name === "") {
			throw new InvalidPathError(name, "directory name cannot be empty");
		}
		this.#validateName(name);
		return this.disk.getOrCreateDirectory(`${this.path}${name}/`);
	}

	file(name: string): StorageFile {
		if (name === "") {
			throw new InvalidPathError(name, "file name cannot be empty");
		}
		this.#validateName(name);
		return this.disk.getOrCreateFile(`${this.path}${name}`);
	}

	#validateName(name: string): void {
		if (name === "." || name === "..") {
			throw new InvalidPathError(name, "path traversal segments are not allowed");
		}
		if (name.includes("/") || name.includes("\\")) {
			throw new InvalidPathError(name, "name must be a single path segment without slashes");
		}
		const invalidChars = this.#endpoint.invalidNameChars;
		if (invalidChars) {
			for (const char of name) {
				if (invalidChars.includes(char)) {
					throw InvalidPathError.forInvalidCharacters(`${this.path}${name}`, this.#endpoint);
				}
			}
		}
	}

	protected override getToStringExtra(): string | undefined {
		return `${this.#endpoint.name}:/${this.path}`;
	}
}

const emptyGenerator = async function* () {};
