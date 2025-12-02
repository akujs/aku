import { S3Client, S3Errors } from "@bradenmacdonald/s3-lite-client";
import { md5 } from "../../../helpers/hash/digest.ts";
import { BaseClass, withoutUndefinedValues } from "../../../utils.ts";
import type {
	StorageEndpoint,
	StorageEndpointFileInfoResult,
	StorageEndpointFileReadResult,
	StorageEndpointWriteOptions,
} from "../../contracts/Storage.ts";
import { NotFoundError, PermissionsError, StorageUnknownError } from "../../storage-errors.ts";
import type { S3StorageConfig } from "./S3StorageConfig.ts";

export class S3Endpoint extends BaseClass implements StorageEndpoint {
	readonly name = "s3" as const;
	readonly supportsMimeTypes = true;
	readonly invalidNameChars = "";
	readonly client: S3Client;
	readonly bucket: string;
	readonly regionForSigning: string;
	readonly bucketUrlStyle: "path" | "subdomain";
	readonly #endpoint: string;

	constructor(config: S3StorageConfig) {
		super();

		const endpoint = parseEndpoint(config.endpoint);
		if (endpoint.isAws && !endpoint.region && !config.regionForSigning) {
			throw new Error(
				'AWS endpoint URLs must either use the format "https://s3.{region}.amazonaws.com" or you must explicitly specify "regionForSigning".',
			);
		}

		this.regionForSigning = config.regionForSigning ?? endpoint.region ?? "auto";
		this.bucketUrlStyle = config.bucketUrlStyle ?? (endpoint.isAws ? "subdomain" : "path");
		this.bucket = config.bucket;
		this.#endpoint = config.endpoint;
		this.client = new S3Client(
			withoutUndefinedValues({
				endPoint: config.endpoint,
				accessKey: config.accessKey,
				secretKey: config.secretKey,
				sessionToken: config.sessionToken,
				region: this.regionForSigning,
				pathStyle: this.bucketUrlStyle === "path",
			}),
		);
	}

	#pathToKey(path: string): string {
		return path.startsWith("/") ? path.slice(1) : path;
	}

	async readSingle(path: string): Promise<StorageEndpointFileReadResult> {
		return await withS3Errors(path, `read ${path}`, async () => {
			const { body, headers } = await this.client.getObject(this.#pathToKey(path), {
				bucketName: this.bucket,
			});

			const contentType = headers.get("Content-Type");
			const contentLength = headers.get("Content-Length");
			const etag = headers.get("ETag");

			if (!body) {
				throw new StorageUnknownError(`read ${path}`, new Error("Response body is null"));
			}

			const parsedContentLength = Number.parseInt(contentLength ?? "", 10);
			if (Number.isNaN(parsedContentLength)) {
				throw new StorageUnknownError(
					`read ${path}`,
					new Error(`Response has missing or invalid Content-Length header: ${contentLength}`),
				);
			}

			return {
				contentLength: parsedContentLength,
				mimeType: contentType || null,
				etag: etag || null,
				data: body,
			};
		});
	}

	async writeSingle(options: StorageEndpointWriteOptions): Promise<void> {
		return await withS3Errors(options.path, `write ${options.path}`, async () => {
			const metadata: Record<string, string> = {};
			if (options.mimeType) {
				metadata["Content-Type"] = options.mimeType;
			}

			let data: ReadableStream<Uint8Array> | Uint8Array | string;

			if (
				options.data instanceof ReadableStream ||
				typeof options.data === "string" ||
				options.data instanceof Uint8Array
			) {
				data = options.data;
			} else if (options.data instanceof ArrayBuffer) {
				data = new Uint8Array(options.data);
			} else if (ArrayBuffer.isView(options.data)) {
				data = new Uint8Array(
					options.data.buffer,
					options.data.byteOffset,
					options.data.byteLength,
				);
			} else {
				const response = new Response(options.data);
				data = response.body ?? new Uint8Array();
			}

			await this.client.putObject(this.#pathToKey(options.path), data, {
				bucketName: this.bucket,
				metadata,
			});
		});
	}

	async getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult> {
		return await withS3Errors(path, `get info for ${path}`, async () => {
			const stat = await this.client.statObject(this.#pathToKey(path), {
				bucketName: this.bucket,
			});

			return {
				contentLength: stat.size,
				mimeType: stat.metadata["Content-Type"] || null,
				etag: stat.etag.replace(/"/g, ""),
			};
		});
	}

	async getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string> {
		return await withS3Errors(path, `generate public URL for ${path}`, async () => {
			const url = new URL(this.#endpoint);
			const s3Key = this.#pathToKey(path);

			if (this.bucketUrlStyle === "path") {
				url.pathname += (url.pathname.endsWith("/") ? "" : "/") + `${this.bucket}/${s3Key}`;
			} else {
				url.host = `${this.bucket}.${url.host}`;
			}

			if (downloadFileName) {
				url.searchParams.set(
					"response-content-disposition",
					`attachment; filename="${downloadFileName}"`,
				);
			}

			return url.toString();
		});
	}

	async getSignedDownloadUrl(
		path: string,
		expires: Date,
		downloadFileName?: string,
	): Promise<string> {
		return await withS3Errors(path, `generate signed URL for ${path}`, async () => {
			const now = new Date();
			const seconds = Math.floor((expires.getTime() - now.getTime()) / 1000);
			// Clamp to valid range: 1 second to 7 days (604800 seconds)
			// This is an AWS S3/R2 limitation, not arbitrary
			const expirySeconds = Math.max(1, Math.min(604800, seconds));

			const options: {
				bucketName: string;
				expirySeconds: number;
				responseParams?: Record<string, string>;
			} = {
				bucketName: this.bucket,
				expirySeconds,
			};

			if (downloadFileName) {
				options.responseParams = {
					"response-content-disposition": `attachment; filename="${downloadFileName}"`,
				};
			}

			return await this.client.presignedGetObject(this.#pathToKey(path), options);
		});
	}

	async getTemporaryUploadUrl(path: string, expires: Date): Promise<string> {
		return await withS3Errors(path, `generate upload URL for ${path}`, async () => {
			const now = new Date();
			const seconds = Math.floor((expires.getTime() - now.getTime()) / 1000);
			// Clamp to valid range: 1 second to 7 days (604800 seconds)
			// This is an AWS S3/R2 limitation, not arbitrary
			const expirySeconds = Math.max(1, Math.min(604800, seconds));

			return await this.client.getPresignedUrl("PUT", this.#pathToKey(path), {
				bucketName: this.bucket,
				expirySeconds,
			});
		});
	}

	async copy(source: string, destination: string): Promise<void> {
		return await withS3Errors(source, `copy ${source} to ${destination}`, async () => {
			await this.client.copyObject(
				{
					sourceBucketName: this.bucket,
					sourceKey: this.#pathToKey(source),
				},
				this.#pathToKey(destination),
				{
					bucketName: this.bucket,
				},
			);
		});
	}

	async move(source: string, destination: string): Promise<void> {
		await this.copy(source, destination);
		await this.deleteSingle(source);
	}

	async existsSingle(path: string): Promise<boolean> {
		return await withS3Errors(path, `check existence of ${path}`, async () => {
			return await this.client.exists(this.#pathToKey(path), {
				bucketName: this.bucket,
			});
		});
	}

	async existsAnyUnderPrefix(prefix: string): Promise<boolean> {
		return await withS3Errors(prefix, `check existence under ${prefix}`, async () => {
			for await (const _obj of this.client.listObjects({
				bucketName: this.bucket,
				prefix: this.#pathToKey(prefix),
				maxResults: 1,
			})) {
				return true;
			}
			return false;
		});
	}

	async *listEntries(prefix: string): AsyncGenerator<string, void> {
		try {
			const s3Prefix = this.#pathToKey(prefix);
			for await (const entry of this.client.listObjectsGrouped({
				bucketName: this.bucket,
				prefix: s3Prefix,
				delimiter: "/",
			})) {
				if (entry.type === "Object") {
					yield entry.key.substring(s3Prefix.length);
				} else if (entry.type === "CommonPrefix") {
					yield entry.prefix.substring(s3Prefix.length);
				}
			}
		} catch (error) {
			throw convertError(error, prefix, `list entries under ${prefix}`);
		}
	}

	async *listFilesRecursive(prefix: string): AsyncGenerator<string, void> {
		try {
			const s3Prefix = this.#pathToKey(prefix);
			for await (const obj of this.client.listObjects({
				bucketName: this.bucket,
				prefix: s3Prefix,
			})) {
				const relativePath = obj.key.substring(s3Prefix.length);
				if (relativePath) {
					yield relativePath;
				}
			}
		} catch (error) {
			throw convertError(error, prefix, `list files recursively under ${prefix}`);
		}
	}

	async deleteSingle(path: string): Promise<void> {
		return await withS3Errors(path, `delete ${path}`, async () => {
			await this.client.deleteObject(this.#pathToKey(path), {
				bucketName: this.bucket,
			});
		});
	}

	async deleteAllUnderPrefix(prefix: string): Promise<void> {
		return await withS3Errors(prefix, `delete all files under ${prefix}`, async () => {
			const maxDeleteCount = 1000;
			let batch: string[] = [];

			for await (const obj of this.client.listObjects({
				bucketName: this.bucket,
				prefix: this.#pathToKey(prefix),
			})) {
				batch.push(obj.key);

				if (batch.length === maxDeleteCount) {
					await deleteBatch(this.client, this.bucket, batch);
					batch = [];
				}
			}

			if (batch.length > 0) {
				await deleteBatch(this.client, this.bucket, batch);
			}
		});
	}
}

async function deleteBatch(client: S3Client, bucket: string, keys: string[]): Promise<void> {
	const objects = keys.map((key) => `<Object><Key>${escapeXml(key)}</Key></Object>`).join("");
	const payload = `<?xml version="1.0" encoding="UTF-8"?><Delete>${objects}</Delete>`;

	const headers = new Headers();
	headers.set("Content-MD5", md5(payload, "base64"));

	await client.makeRequest({
		method: "POST",
		objectName: "",
		bucketName: bucket,
		query: "delete",
		payload,
		headers,
	});
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function parseEndpoint(endpoint: string): {
	isAws: boolean;
	region?: string | undefined;
} {
	const url = new URL(endpoint);
	const host = url.hostname;

	if (!host.endsWith(".amazonaws.com")) {
		return { isAws: false };
	}

	// Match s3.{region}.amazonaws.com
	// Or s3.dualstack.{region}.amazonaws.com
	const match = host.match(/^s3\.(?:dualstack\.)?([^.]+)\.amazonaws\.com$/);

	return { isAws: true, region: match?.[1] };
}

function convertError(error: unknown, path: string, operation: string): Error {
	if (error instanceof S3Errors.ServerError) {
		if (error.statusCode === 404) {
			return new NotFoundError(path);
		}

		if (error.statusCode === 403) {
			return PermissionsError.forHttpError(path, error.statusCode);
		}
	}

	return new StorageUnknownError(operation, error);
}

async function withS3Errors<T>(path: string, operation: string, fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		throw convertError(error, path, operation);
	}
}
