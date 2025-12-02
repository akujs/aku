import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { durationStringToDate } from "../helpers/time.ts";
import { BaseClass } from "../utils.ts";
import type {
	StorageData,
	StorageDisk,
	StorageEndpoint,
	StorageEndpointFileInfoResult,
	StorageFile,
	StorageFileFetchResult,
	StorageFileInfo,
	StorageFilePutPayload,
	StorageFileSignedUrlOptions,
	StorageFileUploadUrlOptions,
	StorageFileUrlOptions,
} from "./contracts/Storage.ts";
import { mimeTypeFromFileName } from "./file-names.ts";
import { InvalidPathError } from "./storage-errors.ts";
import {
	FileCopiedEvent,
	FileCopyingEvent,
	FileDeletedEvent,
	FileDeletingEvent,
	FileExistenceCheckedEvent,
	FileExistenceCheckingEvent,
	FileInfoRetrievedEvent,
	FileInfoRetrievingEvent,
	FileMovedEvent,
	FileMovingEvent,
	FileReadEvent,
	FileReadingEvent,
	FileUrlGeneratedEvent,
	FileUrlGeneratingEvent,
	FileWritingEvent,
	FileWrittenEvent,
} from "./storage-events.ts";
import { storageOperation } from "./storage-operation.ts";

export class StorageFileImpl extends BaseClass implements StorageFile {
	readonly type = "file" as const;
	readonly path: string;
	readonly disk: StorageDisk;
	readonly #endpoint: StorageEndpoint;
	readonly #dispatcher: Dispatcher;

	constructor(disk: StorageDisk, endpoint: StorageEndpoint, path: string, dispatcher: Dispatcher) {
		super();
		this.disk = disk;
		this.path = path;
		this.#endpoint = endpoint;
		this.#dispatcher = dispatcher;
		if (!path.startsWith("/")) {
			throw new InvalidPathError(path, "must start with a slash");
		}
	}

	async delete(): Promise<void> {
		await storageOperation(
			"file:delete",
			() => this.#endpoint.deleteSingle(this.path),
			() => new FileDeletingEvent(this.disk, this.path),
			(start) => new FileDeletedEvent(start),
			this.#dispatcher,
			{ onNotFound: undefined },
		);
	}

	async exists(): Promise<boolean> {
		return await storageOperation(
			"file:existence-check",
			() => this.#endpoint.existsSingle(this.path),
			() => new FileExistenceCheckingEvent(this.disk, this.path),
			(start, exists) => new FileExistenceCheckedEvent(start, exists),
			this.#dispatcher,
			{ onNotFound: false },
		);
	}

	async get(): Promise<StorageFileFetchResult> {
		return await storageOperation(
			"file:read",
			async (): Promise<StorageFileFetchResult> => {
				const endpointResult = await this.#endpoint.readSingle(this.path);

				let mimeType = endpointResult.mimeType;
				if (!mimeType || !this.#endpoint.supportsMimeTypes) {
					mimeType = mimeTypeFromFileName(this.path) ?? "application/octet-stream";
				}

				return {
					size: endpointResult.contentLength,
					mimeType,
					originalMimeType: endpointResult.mimeType,
					etag: endpointResult.etag,

					response: new Response(endpointResult.data, {
						status: 200,
						headers: {
							"Content-Type": mimeType,
							"Content-Length": endpointResult.contentLength.toString(),
							...(endpointResult.etag ? { ETag: endpointResult.etag } : {}),
						},
					}),
				};
			},
			() => new FileReadingEvent(this.disk, this.path),
			(start, result) => new FileReadEvent(start, result.response),
			this.#dispatcher,
			{ onNotFound: "throw" },
		);
	}

	async getText(): Promise<string> {
		const { response } = await this.get();
		return await response.text();
	}

	async getJson(): Promise<unknown> {
		const { response } = await this.get();
		return await response.json();
	}

	async getUint8Array(): Promise<Uint8Array> {
		const { response } = await this.get();
		const arrayBuffer = await response.arrayBuffer();
		return new Uint8Array(arrayBuffer);
	}

	async info(): Promise<StorageFileInfo | null> {
		return await storageOperation(
			"file:info-retrieve",
			async (): Promise<StorageFileInfo | null> => {
				let endpointInfo: StorageEndpointFileInfoResult;
				endpointInfo = await this.#endpoint.getInfoSingle(this.path);

				let mimeType = endpointInfo.mimeType;
				if (!mimeType || !this.#endpoint.supportsMimeTypes) {
					mimeType = mimeTypeFromFileName(this.path) ?? "application/octet-stream";
				}

				return {
					etag: endpointInfo.etag,
					size: endpointInfo.contentLength,
					mimeType,
					originalMimeType: endpointInfo.mimeType,
				};
			},
			() => new FileInfoRetrievingEvent(this.disk, this.path),
			(start, result) => new FileInfoRetrievedEvent(start, result),
			this.#dispatcher,
			{ onNotFound: null },
		);
	}

	async url(options?: StorageFileUrlOptions): Promise<string> {
		const urlOptions: { expires?: string | Date; downloadAs?: string } = { expires: "100y" };
		if (options?.downloadAs) {
			urlOptions.downloadAs = options.downloadAs;
		}
		return await storageOperation(
			"file:url-generate",
			() =>
				this.#endpoint.getSignedDownloadUrl(
					this.path,
					durationStringToDate("100y"),
					options?.downloadAs,
				),
			() => new FileUrlGeneratingEvent(this.disk, this.path, "url", urlOptions),
			(start, url) => new FileUrlGeneratedEvent(start, url),
			this.#dispatcher,
			{ onNotFound: "throw" },
		);
	}

	async signedUrl(options?: StorageFileSignedUrlOptions): Promise<string> {
		const urlOptions: { expires?: string | Date; downloadAs?: string } = {
			expires: options?.expires ?? "100y",
		};
		if (options?.downloadAs) {
			urlOptions.downloadAs = options.downloadAs;
		}
		return await storageOperation(
			"file:url-generate",
			() =>
				this.#endpoint.getSignedDownloadUrl(
					this.path,
					durationStringToDate(options?.expires ?? "100y"),
					options?.downloadAs,
				),
			() => new FileUrlGeneratingEvent(this.disk, this.path, "signed", urlOptions),
			(start, url) => new FileUrlGeneratedEvent(start, url),
			this.#dispatcher,
			{ onNotFound: "throw" },
		);
	}

	async uploadUrl(options?: StorageFileUploadUrlOptions): Promise<string> {
		const urlOptions: { expires?: string | Date; downloadAs?: string } = {
			expires: options?.expires ?? "100y",
		};
		return await storageOperation(
			"file:url-generate",
			() =>
				this.#endpoint.getTemporaryUploadUrl(
					this.path,
					durationStringToDate(options?.expires ?? "100y"),
				),
			() => new FileUrlGeneratingEvent(this.disk, this.path, "upload", urlOptions),
			(start, url) => new FileUrlGeneratedEvent(start, url),
			this.#dispatcher,
			{ onNotFound: "throw" },
		);
	}

	async put(payload: StorageData | StorageFilePutPayload | File | Request): Promise<void> {
		let data: StorageData;
		let mimeType: string | null | undefined;

		if (payload instanceof File) {
			data = payload;
			mimeType = payload.type;
		} else if (payload instanceof Request) {
			if (payload.body == null) {
				return;
			}
			data = payload.body;
			mimeType = payload.headers.get("Content-Type");
		} else if (payload != null && typeof payload === "object" && "data" in payload) {
			data = payload.data;
			mimeType = payload.mimeType;
		} else {
			data = payload;
		}

		mimeType ||= mimeTypeFromFileName(this.path);

		await storageOperation(
			"file:write",
			() =>
				this.#endpoint.writeSingle({
					path: this.path,
					data,
					mimeType,
				}),
			() => new FileWritingEvent(this.disk, this.path, data, mimeType),
			(start) => new FileWrittenEvent(start),
			this.#dispatcher,
			{ onNotFound: "throw" },
		);
	}

	async copyTo(destination: StorageFile): Promise<void> {
		if (destination.disk === this.disk) {
			await storageOperation(
				"file:copy",
				() => this.#endpoint.copy(this.path, destination.path),
				() => new FileCopyingEvent(this.disk, this.path, destination.disk.name, destination.path),
				(start) => new FileCopiedEvent(start),
				this.#dispatcher,
				{ onNotFound: "throw" },
			);
			return;
		}

		const { response, originalMimeType } = await this.get();

		await destination.put({
			data: response.body ?? new Uint8Array(),
			mimeType: originalMimeType,
		});
	}

	async moveTo(destination: StorageFile): Promise<void> {
		if (destination.disk === this.disk) {
			await storageOperation(
				"file:move",
				() => this.#endpoint.move(this.path, destination.path),
				() => new FileMovingEvent(this.disk, this.path, destination.disk.name, destination.path),
				(start) => new FileMovedEvent(start),
				this.#dispatcher,
				{ onNotFound: "throw" },
			);
			return;
		}

		// For cross-disk move, use underlying operations which will dispatch their own events
		await this.copyTo(destination);
		await this.delete();
	}

	protected override getToStringExtra(): string | undefined {
		return `${this.#endpoint.name}:/${this.path}`;
	}
}
