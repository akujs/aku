import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import type {
	StorageDirectoryOperations,
	StorageDisk,
	StorageEndpoint,
} from "./contracts/Storage.ts";
import { DelegatesToDirectory } from "./DelegatesToDirectory.ts";
import { StorageDirectoryImpl } from "./StorageDirectoryImpl.ts";

export class StorageDiskImpl extends DelegatesToDirectory implements StorageDisk {
	readonly name: string;
	readonly endpoint: StorageEndpoint;
	readonly #rootDirectory: StorageDirectoryImpl;

	constructor(name: string, endpoint: StorageEndpoint, dispatcher: Dispatcher) {
		super();
		this.name = name;
		this.endpoint = endpoint;
		this.#rootDirectory = new StorageDirectoryImpl(this, endpoint, "/", dispatcher);
	}

	protected override getDirectoryForDelegation(): StorageDirectoryOperations {
		return this.#rootDirectory;
	}

	protected override getToStringExtra(): string | undefined {
		return this.endpoint.name + "://" + this.name;
	}
}
