import type { StorageAdapter, StorageDisk, StorageEndpoint } from "../../contracts/Storage.ts";

/***/
export interface ReadOnlyStorageConfig {
	disk: string | StorageAdapter | StorageEndpoint | StorageDisk;
}
