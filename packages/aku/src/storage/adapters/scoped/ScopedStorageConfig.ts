import type { StorageAdapter, StorageDisk, StorageEndpoint } from "../../contracts/Storage.ts";

/***/
export interface ScopedStorageConfig {
	/**
	 * The backing disk to wrap, see
	 */
	disk: string | StorageAdapter | StorageEndpoint | StorageDisk;

	/**
	 * The path prefix to apply to all operations, e.g. "/videos/"
	 */
	prefix: string;
}
