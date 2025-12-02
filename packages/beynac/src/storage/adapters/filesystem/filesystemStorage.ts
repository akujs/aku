import type { StorageAdapter } from "../../contracts/Storage.ts";
import { FilesystemEndpoint } from "./FilesystemEndpoint.ts";
import type { FilesystemStorageConfig } from "./FilesystemStorageConfig.ts";

/**
 * Create storage backed by the filesystem
 */
export function filesystemStorage(config: FilesystemStorageConfig): StorageAdapter {
	return {
		build(container) {
			return container.construct(FilesystemEndpoint, config);
		},
	};
}
