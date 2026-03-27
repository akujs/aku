import { BaseClass } from "../utils.ts";
import type {
	StorageDirectory,
	StorageDirectoryOperations,
	StorageFile,
} from "./contracts/Storage.ts";

export abstract class DelegatesToDirectory extends BaseClass implements StorageDirectoryOperations {
	protected abstract getDirectoryForDelegation(): StorageDirectoryOperations;

	async exists(): Promise<boolean> {
		return await this.getDirectoryForDelegation().exists();
	}

	async list(): Promise<Array<StorageFile | StorageDirectory>> {
		return await this.getDirectoryForDelegation().list();
	}

	listStreaming(): AsyncGenerator<StorageFile | StorageDirectory, void> {
		return this.getDirectoryForDelegation().listStreaming();
	}

	async listFiles(options?: { recursive?: boolean | undefined }): Promise<Array<StorageFile>> {
		return await this.getDirectoryForDelegation().listFiles(options);
	}

	listFilesStreaming(options?: {
		recursive?: boolean | undefined;
	}): AsyncGenerator<StorageFile, void> {
		return this.getDirectoryForDelegation().listFilesStreaming(options);
	}

	async listDirectories(): Promise<Array<StorageDirectory>> {
		return await this.getDirectoryForDelegation().listDirectories();
	}

	listDirectoriesStreaming(): AsyncGenerator<StorageDirectory, void> {
		return this.getDirectoryForDelegation().listDirectoriesStreaming();
	}

	async deleteAll(): Promise<void> {
		return await this.getDirectoryForDelegation().deleteAll();
	}

	directory(name: string): StorageDirectory {
		return this.getDirectoryForDelegation().directory(name);
	}

	file(name: string): StorageFile {
		return this.getDirectoryForDelegation().file(name);
	}
}
