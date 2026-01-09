import type { StorageAdapter } from "../../contracts/Storage.ts";
import { S3Endpoint } from "./S3Endpoint.ts";
import type { S3StorageConfig } from "./S3StorageConfig.ts";

/**
 * Create an S3-compatible storage adapter
 */
export function s3Storage(config: S3StorageConfig): StorageAdapter {
	return {
		build(container) {
			return container.construct(S3Endpoint, config);
		},
	};
}
