import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import { onResetAllMocks } from "../testing/mocks.ts";

export type Dir = fs.Dir;
export type Stats = fs.Stats;

export type FilesystemOps = {
	stat(this: void, path: string): Promise<fs.Stats>;
	mkdir(this: void, path: string, options?: fs.MakeDirectoryOptions): Promise<unknown>;
	opendir(this: void, path: string): Promise<fs.Dir>;
	unlink(this: void, path: string): Promise<void>;
	copyFile(this: void, source: string, destination: string): Promise<void>;
	rename(this: void, oldPath: string, newPath: string): Promise<void>;
	access(this: void, path: string, mode?: number): Promise<void>;
	rm(this: void, path: string, options?: fs.RmOptions): Promise<void>;
	createReadStream(this: void, path: string): fs.ReadStream;
	createWriteStream(this: void, path: string): fs.WriteStream;
};

const realFs: FilesystemOps = {
	stat: fsPromises.stat,
	mkdir: fsPromises.mkdir,
	opendir: fsPromises.opendir,
	unlink: fsPromises.unlink,
	copyFile: fsPromises.copyFile,
	rename: fsPromises.rename,
	access: fsPromises.access,
	rm: fsPromises.rm,
	createReadStream: fs.createReadStream,
	createWriteStream: fs.createWriteStream,
};

let currentFs: FilesystemOps = realFs;

export const fsOps: FilesystemOps = {
	get stat() {
		return currentFs.stat;
	},
	get mkdir() {
		return currentFs.mkdir;
	},
	get opendir() {
		return currentFs.opendir;
	},
	get unlink() {
		return currentFs.unlink;
	},
	get copyFile() {
		return currentFs.copyFile;
	},
	get rename() {
		return currentFs.rename;
	},
	get access() {
		return currentFs.access;
	},
	get rm() {
		return currentFs.rm;
	},
	get createReadStream() {
		return currentFs.createReadStream;
	},
	get createWriteStream() {
		return currentFs.createWriteStream;
	},
};

export function mockFilesystemOperations(ops: FilesystemOps): void {
	currentFs = ops;
	onResetAllMocks(() => {
		currentFs = realFs;
	});
}
