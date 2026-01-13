import { BaseClass } from "../utils.ts";
import type { Storage, StorageAdapter, StorageDisk, StorageEndpoint } from "./contracts/Storage.ts";
import { StorageDiskImpl } from "./StorageDiskImpl.ts";

export function isConfiguredStorageDriver(value: unknown): value is StorageAdapter {
	return typeof (value as StorageAdapter | null)?.build === "function";
}

export function isStorageEndpoint(value: unknown): value is StorageEndpoint {
	return typeof (value as StorageEndpoint | null)?.readSingle === "function";
}

export function isStorageDisk(value: unknown): value is StorageDisk {
	return value instanceof StorageDiskImpl;
}

export abstract class WrappedEndpoint extends BaseClass {
	readonly #diskConfig: string | StorageAdapter | StorageEndpoint | StorageDisk;
	readonly #getStorage: () => Storage;
	#endpoint: StorageEndpoint | null = null;

	constructor(
		diskConfig: string | StorageAdapter | StorageEndpoint | StorageDisk,
		getStorage: () => Storage,
	) {
		super();
		this.#diskConfig = diskConfig;
		this.#getStorage = getStorage;
	}

	protected get endpoint(): StorageEndpoint {
		if (this.#endpoint) {
			return this.#endpoint;
		}

		let config = this.#diskConfig;

		if (typeof config === "string") {
			config = this.#getStorage().disk(config);
		}
		if (isConfiguredStorageDriver(config)) {
			config = this.#getStorage().build(config);
		}
		if (isStorageDisk(config)) {
			config = config.endpoint;
		}
		this.#endpoint = config;

		return this.#endpoint;
	}

	get supportsMimeTypes(): boolean {
		return this.endpoint.supportsMimeTypes;
	}

	get invalidNameChars(): string {
		return this.endpoint.invalidNameChars;
	}
}
