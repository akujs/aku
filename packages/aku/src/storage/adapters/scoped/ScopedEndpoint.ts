import { injectFactory } from "../../../container/inject.ts";
import type {
	Storage,
	StorageEndpoint,
	StorageEndpointCopyMoveOptions,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
	StorageEndpointPublicDownloadUrlOptions,
	StorageEndpointSignedDownloadUrlOptions,
	StorageEndpointWriteOptions,
} from "../../contracts/Storage.ts";
import { Storage as StorageKey } from "../../contracts/Storage.ts";
import { WrappedEndpoint } from "../../storage-utils.ts";
import type { ScopedStorageConfig } from "./ScopedStorageConfig.ts";

export class ScopedEndpoint extends WrappedEndpoint implements StorageEndpoint {
	readonly name = "scoped" as const;
	readonly #prefix: string;

	constructor(
		{ prefix, disk }: ScopedStorageConfig,
		getStorage: () => Storage = injectFactory(StorageKey),
	) {
		super(disk, getStorage);
		if (!prefix.endsWith("/")) {
			prefix = `${prefix}/`;
		}
		if (!prefix.startsWith("/")) {
			prefix = `/${prefix}`;
		}
		this.#prefix = prefix;
	}

	async writeSingle(options: StorageEndpointWriteOptions): Promise<void> {
		await this.endpoint.writeSingle({
			...options,
			path: this.#addPrefix(options.path),
		});
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		return await this.endpoint.readSingle(this.#addPrefix(path));
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult> {
		return await this.endpoint.getInfoSingle(this.#addPrefix(path));
	}

	async getPublicDownloadUrl(
		path: string,
		options?: StorageEndpointPublicDownloadUrlOptions,
	): Promise<string> {
		return await this.endpoint.getPublicDownloadUrl(this.#addPrefix(path), options);
	}

	async getSignedDownloadUrl(
		path: string,
		options: StorageEndpointSignedDownloadUrlOptions,
	): Promise<string> {
		return await this.endpoint.getSignedDownloadUrl(this.#addPrefix(path), options);
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		return await this.endpoint.getTemporaryUploadUrl(this.#addPrefix(path), expires);
	}

	async copy(options: StorageEndpointCopyMoveOptions): Promise<void> {
		await this.endpoint.copy({
			source: this.#addPrefix(options.source),
			destination: this.#addPrefix(options.destination),
		});
	}

	async move(options: StorageEndpointCopyMoveOptions): Promise<void> {
		await this.endpoint.move({
			source: this.#addPrefix(options.source),
			destination: this.#addPrefix(options.destination),
		});
	}

	async existsSingle(path: string): Promise<boolean> {
		return await this.endpoint.existsSingle(this.#addPrefix(path));
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		return await this.endpoint.existsAnyUnderPrefix(this.#addPrefix(prefix));
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		yield* this.endpoint.listEntries(this.#addPrefix(prefix));
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		yield* this.endpoint.listFilesRecursive(this.#addPrefix(prefix));
	}

	async deleteSingle(path: string): Promise<void> {
		await this.endpoint.deleteSingle(this.#addPrefix(path));
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		await this.endpoint.deleteAllUnderPrefix(this.#addPrefix(prefix));
	}

	#addPrefix(path: string): string {
		return this.#prefix + path.slice(1);
	}
}
