import type { StorageAdapter } from "../../contracts/Storage.ts";
import { ScopedEndpoint } from "./ScopedEndpoint.ts";
import type { ScopedStorageConfig } from "./ScopedStorageConfig.ts";

/**
 * Scoped storage adapter that wraps an existing disk and automatically applies
 * a path prefix to all operations.
 *
 * This is useful for isolating file operations to a specific directory within
 * a larger storage system without having to manually include the prefix in
 * every operation.
 *
 * Wrapped disks can be:
 * - A disk name (string) to wrap a configured, named disk
 * - A disk configuration (e.g. filesystemStorage(...))
 * - A StorageDisk instance as returned by storage.disk()
 * - A StorageEndpoint instance (the low-level interface implemented by storage adapters)
 *
 * @example
 * {
 *   disks: {
 *     local: filesystemStorage({ rootPath: '/var/storage' }),
 *     images: scopedStorage({
 *       disk: 'local',
 *       prefix: '/videos/'
 *     })
 *   }
 * }
 */
export function scopedStorage(config: ScopedStorageConfig): StorageAdapter {
	return {
		build(container) {
			return container.construct(ScopedEndpoint, config);
		},
	};
}
