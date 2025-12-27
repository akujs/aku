import { sha256 } from "../../../helpers/hash/digest.ts";
import { BaseClass, describeType } from "../../../utils.ts";
import type {
	StorageEndpoint,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
	StorageEndpointWriteOptions,
} from "../../contracts/Storage.ts";
import { NotFoundError } from "../../storage-errors.ts";
import type { MemoryStorageConfig } from "./MemoryStorageConfig.ts";

interface MemoryFile {
	data: Uint8Array;
	mimeType: string | null;
	etag: string;
}

export class MemoryEndpoint extends BaseClass implements StorageEndpoint {
	readonly name = "memory" as const;
	readonly #files: Map<string, MemoryFile> = new Map();
	readonly supportsMimeTypes: boolean;
	readonly invalidNameChars: string;
	readonly #fakeUrls: boolean;

	constructor(config: MemoryStorageConfig) {
		super();
		const supportsMimeTypes = config.supportsMimeTypes ?? true;
		this.supportsMimeTypes = supportsMimeTypes;
		this.invalidNameChars = config.invalidNameChars ?? "";
		this.#fakeUrls = config.fakeUrls ?? false;

		if (config.initialFiles) {
			for (const [path, fileData] of Object.entries(config.initialFiles)) {
				const normalisedPath = path.startsWith("/") ? path : `/${path}`;
				if (typeof fileData === "string") {
					this.#writeSingleSync(normalisedPath, fileData, supportsMimeTypes ? "text/plain" : null);
				} else if (fileData.data != null) {
					this.#writeSingleSync(
						normalisedPath,
						fileData.data,
						supportsMimeTypes ? fileData.mimeType : null,
					);
				}
			}
		}
	}

	async writeSingle({ data, path, mimeType }: StorageEndpointWriteOptions): Promise<void> {
		const response = new Response(data);
		const serialised = await response.arrayBuffer();
		this.#writeSingleSync(path, serialised, mimeType);
	}

	#writeSingleSync(
		path: string,
		data: string | ArrayBuffer | ArrayBufferView,
		mimeType: string | null | undefined,
	): void {
		validatePath(path);
		const binaryData = serialize(data);

		const etag = sha256(binaryData);

		this.#files.set(path, {
			data: binaryData,
			mimeType: mimeType ?? null,
			etag,
		});
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		validatePath(path);
		const file = this.#files.get(path);
		if (!file) {
			throw new NotFoundError(path);
		}

		return {
			contentLength: file.data.length,
			mimeType: file.mimeType,
			etag: file.etag,
			data: file.data,
		};
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult> {
		validatePath(path);
		const file = this.#files.get(path);
		if (!file) {
			throw new NotFoundError(path);
		}

		return {
			contentLength: file.data.length,
			mimeType: file.mimeType,
			etag: file.etag,
		};
	}

	async getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string> {
		validatePath(path);
		this.#requireFakeUrls();
		return fakeUrl(path, { download: downloadFileName });
	}

	async getSignedDownloadUrl(
		path: string,
		expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		validatePath(path);
		this.#requireFakeUrls();
		return fakeUrl(path, {
			download: downloadFileName,
			expires,
		});
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		validatePath(path);
		this.#requireFakeUrls();
		return fakeUrl(path, { upload: "true", expires });
	}

	#requireFakeUrls(): void {
		if (!this.#fakeUrls) {
			throw new Error(
				"memoryStorage does not support URLs, pass fakeUrls:true to generate mock URLs for tests.",
			);
		}
	}

	async copy(source: string, destination: string): Promise<void> {
		validatePath(source);
		validatePath(destination);
		const file = this.#files.get(source);
		if (!file) {
			throw new NotFoundError(source);
		}

		this.#files.set(destination, {
			data: file.data,
			mimeType: file.mimeType,
			etag: file.etag,
		});
	}

	async move(source: string, destination: string): Promise<void> {
		validatePath(source);
		validatePath(destination);
		const file = this.#files.get(source);
		if (!file) {
			throw new NotFoundError(source);
		}

		this.#files.set(destination, file);
		this.#files.delete(source);
	}

	async existsSingle(path: string): Promise<boolean> {
		validatePath(path);
		return this.#files.has(path);
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		validatePath(prefix);
		for (const path of this.#files.keys()) {
			if (path.startsWith(prefix)) {
				return true;
			}
		}
		return false;
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		validatePath(prefix, true);

		const entries = new Set<string>();

		for (const path of this.#files.keys()) {
			if (!path.startsWith(prefix)) {
				continue;
			}

			const relativePath = path.slice(prefix.length);
			const slashIndex = relativePath.indexOf("/");

			if (slashIndex === -1) {
				entries.add(relativePath);
			} else {
				const firstSegment = relativePath.slice(0, slashIndex);
				entries.add(`${firstSegment}/`);
			}
		}

		for (const entry of Array.from(entries).sort()) {
			yield entry;
		}
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		validatePath(prefix, true);

		const files = Array.from(this.#files.keys())
			.filter((path) => path.startsWith(prefix))
			.map((path) => path.slice(prefix.length))
			.sort();

		for (const file of files) {
			yield file;
		}
	}

	async deleteSingle(path: string): Promise<void> {
		validatePath(path);
		this.#files.delete(path);
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		validatePath(prefix);
		const toDelete: string[] = [];

		for (const path of this.#files.keys()) {
			if (path.startsWith(prefix)) {
				toDelete.push(path);
			}
		}

		for (const path of toDelete) {
			this.#files.delete(path);
		}
	}
}

const validatePath = (path: string, endingSlash = false): void => {
	if (!path.startsWith("/")) {
		throw new Error(`Paths must start with a slash: ${path}`);
	}
	if (endingSlash && !path.endsWith("/")) {
		throw new Error(`Path prefixes must end with a slash: ${path}`);
	}
};

const serialize = (data: string | ArrayBuffer | ArrayBufferView): Uint8Array => {
	if (typeof data === "string") {
		return new TextEncoder().encode(data);
	}

	if (data instanceof ArrayBuffer) {
		return new Uint8Array(data);
	}

	if (data instanceof URLSearchParams) {
		return new TextEncoder().encode(data.toString());
	}

	throw new Error(`Unsupported data type: ${describeType(data)}`);
};

const fakeUrl = (
	path: string,
	params: Record<string, string | number | undefined | Date>,
): string => {
	let query = "";
	for (let [key, value] of Object.entries(params)) {
		if (value === undefined) {
			continue;
		}
		if (value instanceof Date) {
			value = value.toISOString();
		}
		query += query ? "&" : "?";
		query += `${key}=${value}`;
	}
	return `memory://${path}${query}`;
};
