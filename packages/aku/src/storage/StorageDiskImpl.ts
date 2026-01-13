import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { StringKeyWeakMap } from "../utils.ts";
import type {
	StorageDirectory,
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
	StorageFile,
} from "./contracts/Storage.ts";
import { DelegatesToDirectory } from "./DelegatesToDirectory.ts";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl.ts";
import { StorageFileImpl } from "./StorageFileImpl.ts";

export class StorageDiskImpl extends DelegatesToDirectory implements StorageDisk {
	readonly name: string;
	readonly endpoint: StorageEndpoint;
	readonly #dispatcher: Dispatcher;
	readonly #rootDirectory: StorageDirectoryImpl;
	readonly #fileCache = new StringKeyWeakMap<StorageFile>();
	readonly #directoryCache = new StringKeyWeakMap<StorageDirectory>();

	constructor(name: string, endpoint: StorageEndpoint, dispatcher: Dispatcher) {
		super();
		this.name = name;
		this.endpoint = endpoint;
		this.#dispatcher = dispatcher;
		this.#rootDirectory = new StorageDirectoryImpl(this, endpoint, "/", dispatcher);
		this.#directoryCache.set("/", this.#rootDirectory);
	}

	getOrCreateFile(path: string): StorageFile {
		let file = this.#fileCache.get(path);
		if (!file) {
			file = new StorageFileImpl(this, this.endpoint, path, this.#dispatcher);
			this.#fileCache.set(path, file);
		}
		return file;
	}

	getOrCreateDirectory(path: string): StorageDirectory {
		let dir = this.#directoryCache.get(path);
		if (!dir) {
			dir = new StorageDirectoryImpl(this, this.endpoint, path, this.#dispatcher);
			this.#directoryCache.set(path, dir);
		}
		return dir;
	}

	protected override getDirectoryForDelegation(): StorageDirectoryOperations {
		return this.#rootDirectory;
	}

	protected override getToStringExtra(): string | undefined {
		return this.endpoint.name + "://" + this.name;
	}
}
