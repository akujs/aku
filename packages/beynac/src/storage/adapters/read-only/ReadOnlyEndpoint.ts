import { injectFactory } from "../../../container/inject.ts";
import type {
	Storage,
	StorageEndpoint,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
	StorageEndpointWriteOptions,
} from "../../contracts/Storage.ts";
import { Storage as StorageKey } from "../../contracts/Storage.ts";
import { PermissionsError } from "../../storage-errors.ts";
import { WrappedEndpoint } from "../../storage-utils.ts";
import type { ReadOnlyStorageConfig } from "./ReadOnlyStorageConfig.ts";

export class ReadOnlyEndpoint extends WrappedEndpoint implements StorageEndpoint {
	readonly name = "read-only" as const;

	constructor(
		{ disk }: ReadOnlyStorageConfig,
		getStorage: () => Storage = injectFactory(StorageKey),
	) {
		super(disk, getStorage);
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		return await this.endpoint.readSingle(path);
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult> {
		return await this.endpoint.getInfoSingle(path);
	}

	async getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string> {
		return await this.endpoint.getPublicDownloadUrl(path, downloadFileName);
	}

	async getSignedDownloadUrl(
		path: string,
		expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		return await this.endpoint.getSignedDownloadUrl(path, expires, downloadFileName);
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		return await this.endpoint.getTemporaryUploadUrl(path, expires);
	}

	async existsSingle(path: string): Promise<boolean> {
		return await this.endpoint.existsSingle(path);
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		return await this.endpoint.existsAnyUnderPrefix(prefix);
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		yield* this.endpoint.listEntries(prefix);
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		yield* this.endpoint.listFilesRecursive(prefix);
	}

	async writeSingle(options: StorageEndpointWriteOptions): Promise<void> {
		throw new PermissionsError(options.path, 403, `"${this.name}" disk is read-only`);
	}

	async copy(source: string, _destination: string): Promise<void> {
		throw new PermissionsError(source, 403, `"${this.name}" disk is read-only`);
	}

	async move(source: string, _destination: string): Promise<void> {
		throw new PermissionsError(source, 403, `"${this.name}" disk is read-only`);
	}

	async deleteSingle(path: string): Promise<void> {
		throw new PermissionsError(path, 403, `"${this.name}" disk is read-only`);
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		throw new PermissionsError(prefix, 403, `"${this.name}" disk is read-only`);
	}
}
