import { injectFactory } from "../../../container/inject.ts";
import type {
	Storage,
	StorageEndpoint,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
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

	async getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string> {
		return await this.endpoint.getPublicDownloadUrl(this.#addPrefix(path), downloadFileName);
	}

	async getSignedDownloadUrl(
		path: string,
		expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		return await this.endpoint.getSignedDownloadUrl(
			this.#addPrefix(path),
			expires,
			downloadFileName,
		);
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		return await this.endpoint.getTemporaryUploadUrl(this.#addPrefix(path), expires);
	}

	async copy(source: string, destination: string): Promise<void> {
		await this.endpoint.copy(this.#addPrefix(source), this.#addPrefix(destination));
	}

	async move(source: string, destination: string): Promise<void> {
		await this.endpoint.move(this.#addPrefix(source), this.#addPrefix(destination));
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
