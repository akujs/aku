import { createHash } from "node:crypto";
import { pipeline, Readable } from "node:stream";
import { promisify } from "node:util";
import { BaseClass } from "../../../utils.ts";
import type {
	StorageEndpoint,
	StorageEndpointCopyMoveOptions,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
	StorageEndpointPublicDownloadUrlOptions,
	StorageEndpointSignedDownloadUrlOptions,
	StorageEndpointWriteOptions,
} from "../../contracts/Storage.ts";
import { joinSlashPaths } from "../../file-names.ts";
import { type Dir, fsOps, type Stats } from "../../filesystem-operations.ts";
import { platform } from "../../path-operations.ts";
import { NotFoundError, PermissionsError, StorageUnknownError } from "../../storage-errors.ts";
import type { FilesystemStorageConfig } from "./FilesystemStorageConfig.ts";

const pipelineAsync = promisify(pipeline);

export class FilesystemEndpoint extends BaseClass implements StorageEndpoint {
	readonly name = "filesystem" as const;
	readonly invalidNameChars = '<>:"/\\|?*';
	readonly supportsMimeTypes = false;
	readonly #rootPath: string;
	readonly #publicUrlPrefix: string | undefined;
	readonly #makePublicUrlWith: ((url: string) => string) | undefined;
	readonly #config: FilesystemStorageConfig;

	constructor(config: FilesystemStorageConfig) {
		super();
		this.#rootPath = config.rootPath;
		this.#publicUrlPrefix = config.publicUrlPrefix;
		this.#makePublicUrlWith = config.makePublicUrlWith;
		this.#config = config;
	}

	async writeSingle({ data, path }: StorageEndpointWriteOptions): Promise<void> {
		const fsPath = this.#toFilesystemPath(path);

		await withNodeErrors(fsPath, async () => {
			await this.#ensureParentDirectoryExists(fsPath);
			const webStream = new Response(data).body;
			const nodeStream = webStream ? Readable.fromWeb(webStream) : Readable.from([]);
			await pipelineAsync(nodeStream, fsOps.createWriteStream(fsPath));
		});
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		const fsPath = this.#toFilesystemPath(path);

		return await withNodeErrors(fsPath, async () => {
			const stats = await fsOps.stat(fsPath);
			const nodeStream = fsOps.createReadStream(fsPath);
			const webStream = Readable.toWeb(nodeStream);
			const wrappedStream = wrapStreamErrors(webStream, (error) => convertNodeError(error, fsPath));
			return {
				contentLength: stats.size,
				mimeType: null,
				etag: this.#generateEtag(stats),
				data: wrappedStream,
			};
		});
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult> {
		const fsPath = this.#toFilesystemPath(path);

		const stats = await withNodeErrors(fsPath, () => fsOps.stat(fsPath));

		return {
			contentLength: stats.size,
			mimeType: null,
			etag: this.#generateEtag(stats),
		};
	}

	async existsSingle(path: string): Promise<boolean> {
		const fsPath = this.#toFilesystemPath(path);
		try {
			await fsOps.access(fsPath);
			return true;
		} catch {
			return false;
		}
	}

	async deleteSingle(path: string): Promise<void> {
		const fsPath = this.#toFilesystemPath(path);
		await withNodeErrors(fsPath, () => fsOps.unlink(fsPath));
	}

	async copy(options: StorageEndpointCopyMoveOptions): Promise<void> {
		const sourceFsPath = this.#toFilesystemPath(options.source);
		const destFsPath = this.#toFilesystemPath(options.destination);

		await withNodeErrors(sourceFsPath, async () => {
			await this.#ensureParentDirectoryExists(destFsPath);
			await fsOps.copyFile(sourceFsPath, destFsPath);
		});
	}

	async move(options: StorageEndpointCopyMoveOptions): Promise<void> {
		const sourceFsPath = this.#toFilesystemPath(options.source);
		const destFsPath = this.#toFilesystemPath(options.destination);

		await withNodeErrors(sourceFsPath, async () => {
			await this.#ensureParentDirectoryExists(destFsPath);
			await fsOps.rename(sourceFsPath, destFsPath);
		});
	}

	async getPublicDownloadUrl(
		path: string,
		options?: StorageEndpointPublicDownloadUrlOptions,
	): Promise<string> {
		if (!this.#publicUrlPrefix && !this.#makePublicUrlWith) {
			throw new Error("publicUrlPrefix or makePublicUrlWith is required for URL generation");
		}

		let url = this.#publicUrlPrefix ? joinSlashPaths(this.#publicUrlPrefix, path) : path;

		if (this.#makePublicUrlWith) {
			url = this.#makePublicUrlWith(url);
		}

		if (options?.downloadAs) {
			const separator = url.includes("?") ? "&" : "?";
			return `${url}${separator}download=${encodeURIComponent(options.downloadAs)}`;
		}

		return url;
	}

	async getSignedDownloadUrl(
		path: string,
		options: StorageEndpointSignedDownloadUrlOptions,
	): Promise<string> {
		if (!this.#config.makeSignedDownloadUrlWith) {
			throw new Error("makeSignedDownloadUrlWith is required for signed URL generation");
		}
		return await this.#config.makeSignedDownloadUrlWith({
			path,
			expires: options.expires,
			downloadFileName: options.downloadAs,
			config: this.#config,
		});
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		if (!this.#config.makeSignedUploadUrlWith) {
			throw new Error("makeSignedUploadUrlWith is required for signed upload URL generation");
		}
		return await this.#config.makeSignedUploadUrlWith({
			path,
			expires,
			config: this.#config,
		});
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		const fsPrefix = this.#toFilesystemPath(prefix);
		return await this.#hasAnyFile(fsPrefix);
	}

	async #hasAnyFile(fsPath: string): Promise<boolean> {
		let dir: Dir | undefined;

		let entries = 0;
		try {
			dir = await fsOps.opendir(fsPath);
			for await (const dirent of dir) {
				++entries;
				if (dirent.isFile()) {
					return true;
				}
				if (dirent.isDirectory()) {
					const subPath = platform.join(fsPath, dirent.name);
					if (await this.#hasAnyFile(subPath)) {
						return true;
					}
				}
			}
			return false;
		} catch (error) {
			const storageError = convertNodeError(error, fsPath);
			if (storageError instanceof NotFoundError) {
				if (entries > 0) {
					// If we successfully got the first entry, but later got a
					// ENOENT, it's either a bug in our code or the directory
					// was deleted while we were iterating, either way throw the
					// node error not NotFoundError
					throw error;
				}
				return false;
			}
			throw storageError;
		} finally {
			try {
				await dir?.close();
			} catch {}
		}
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		yield* this.#streamDirectory({
			rootFsPath: this.#toFilesystemPath(prefix),
			filesOnly: false,
			recursive: false,
		});
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		yield* this.#streamDirectory({
			rootFsPath: this.#toFilesystemPath(prefix),
			filesOnly: true,
			recursive: true,
		});
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		const fsPrefix = this.#toFilesystemPath(prefix);

		await withNodeErrors(fsPrefix, async () => {
			// Use fs.rm with recursive option to remove directory and all contents
			// force: true means it won't throw if the directory doesn't exist
			await fsOps.rm(fsPrefix, { recursive: true, force: true });
		});
	}

	async *#streamDirectory(options: {
		rootFsPath: string;
		filesOnly: boolean;
		recursive: boolean;
		relativePath?: string;
	}): AsyncGenerator<string, void> {
		const { relativePath, rootFsPath, filesOnly, recursive } = options;
		const entries: string[] = [];

		const currentPath = relativePath ? platform.join(rootFsPath, relativePath) : rootFsPath;

		let dir: Dir | undefined;

		try {
			dir = await fsOps.opendir(currentPath);
			for await (const dirent of dir) {
				if (dirent.isDirectory()) {
					entries.push(`${dirent.name}/`);
				} else if (dirent.isFile()) {
					entries.push(dirent.name);
				}
			}
		} catch (error) {
			const storageError = convertNodeError(error, rootFsPath);
			if (storageError instanceof NotFoundError) {
				if (entries.length > 0) {
					// If we successfully got the first entry, but later got a
					// ENOENT, it's either a bug in our code or the directory
					// was deleted while we were iterating, either way throw the
					// node error not NotFoundError
					throw error;
				}
				return;
			}
			throw storageError;
		} finally {
			try {
				await dir?.close();
			} catch {}
		}

		entries.sort();

		for (const entry of entries) {
			const isDirectory = entry.endsWith("/");
			const entryPath = relativePath ? `${relativePath}/${entry}` : entry;

			if (!(filesOnly && isDirectory)) {
				yield entryPath;
			}

			if (recursive && isDirectory) {
				yield* this.#streamDirectory({
					relativePath: entryPath.slice(0, -1),
					rootFsPath,
					filesOnly,
					recursive,
				});
			}
		}
	}

	#toFilesystemPath(storagePath: string): string {
		return platform.join(this.#rootPath, storagePath);
	}

	async #ensureParentDirectoryExists(path: string): Promise<void> {
		await fsOps.mkdir(platform.dirname(path), { recursive: true });
	}

	#generateEtag(stats: Stats): string {
		const data = `${stats.mtimeMs}-${stats.size}`;
		return createHash("sha256").update(data).digest("hex");
	}
}

const convertNodeError = (error: unknown, path: string): Error => {
	if (typeof error === "object" && error !== null && "code" in error) {
		const code = (error as { code: string }).code;
		if (code === "ENOENT" || code === "ENOTDIR") {
			return new NotFoundError(path);
		}
		if (code === "EACCES") {
			return new PermissionsError(path, 0, "EACCES");
		}
	}
	return new StorageUnknownError(`operate on ${path}`, error);
};

function wrapStreamErrors(
	stream: ReadableStream<Uint8Array>,
	convertError: (error: unknown) => Error,
): ReadableStream<Uint8Array> {
	const reader = stream.getReader();

	return new ReadableStream({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					controller.close();
				} else {
					controller.enqueue(value);
				}
			} catch (error) {
				controller.error(convertError(error));
			}
		},
		cancel(reason) {
			return reader.cancel(reason);
		},
	});
}

async function withNodeErrors<T>(path: string, fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		throw convertNodeError(error, path);
	}
}
