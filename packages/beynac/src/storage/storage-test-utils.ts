import type { WriteStream } from "node:fs";
import { ReadStream } from "node:fs";
import { Writable } from "node:stream";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { spyOnAll } from "../test-utils/spy-on-all.ts";
import { BaseClass } from "../utils.ts";
import type { StorageAdapter, StorageEndpoint } from "./contracts/Storage.ts";
import type { Dir, FilesystemOps, Stats } from "./filesystem-operations.ts";
import type { StorageEndpointBuilder } from "./StorageEndpointBuilder.ts";
import { isConfiguredStorageDriver } from "./storage-utils.ts";

export type SharedTestConfig = {
	name: string;
	requiresDocker?: boolean;
	createEndpoint: () => StorageEndpoint | Promise<StorageEndpoint>;
};

export function mockEndpointBuilder(): StorageEndpointBuilder {
	const container = new ContainerImpl();
	return {
		build: (adapter: StorageAdapter | StorageEndpoint) =>
			isConfiguredStorageDriver(adapter) ? adapter.build(container) : adapter,
	};
}

export class MockFilesystemOperations extends BaseClass implements FilesystemOps {
	constructor() {
		super();
		spyOnAll(this);
	}

	async stat(_path: string): Promise<Stats> {
		return {
			isFile: () => true,
			isDirectory: () => false,
			isSymbolicLink: () => false,
			isBlockDevice: () => false,
			isCharacterDevice: () => false,
			isFIFO: () => false,
			isSocket: () => false,
			dev: 0,
			ino: 0,
			mode: 0,
			nlink: 0,
			uid: 0,
			gid: 0,
			rdev: 0,
			size: 0,
			blksize: 0,
			blocks: 0,
			atimeMs: 0,
			mtimeMs: 0,
			ctimeMs: 0,
			birthtimeMs: 0,
			atime: new Date(),
			mtime: new Date(),
			ctime: new Date(),
			birthtime: new Date(),
		} as Stats;
	}

	async mkdir(_path: string, _options?: unknown): Promise<unknown> {
		return;
	}

	async opendir(path: string): Promise<Dir> {
		return {
			path,
			close: async () => {},
			closeSync: () => {},
			read: async () => null,
			readSync: () => null,
			[Symbol.asyncIterator]: async function* () {},
		};
	}

	async unlink(_path: string): Promise<void> {}

	async copyFile(_source: string, _destination: string): Promise<void> {}

	async rename(_oldPath: string, _newPath: string): Promise<void> {}

	async access(_path: string, _mode?: number): Promise<void> {}

	async rm(_path: string, _options?: unknown): Promise<void> {}

	createReadStream(_path: string): ReadStream {
		return ReadStream.from(new Uint8Array()) as ReadStream;
	}

	createWriteStream(_path: string): WriteStream {
		return new Writable({
			write(_chunk, _encoding, callback) {
				callback();
			},
		}) as WriteStream;
	}
}
