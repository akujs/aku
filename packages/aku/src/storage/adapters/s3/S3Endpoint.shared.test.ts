import { S3Client, S3Errors } from "@bradenmacdonald/s3-lite-client";
import { randomId } from "../../../helpers/str/random.ts";
import {
	ensureDockerServicesRunning,
	MINIO_ENDPOINT,
	MINIO_ROOT_PASSWORD,
	MINIO_ROOT_USER,
} from "../../../test-utils/docker.test-utils.ts";
import type { SharedTestConfig } from "../../storage.test-utils.ts";
import { S3Endpoint } from "./S3Endpoint.ts";
import type { S3StorageConfig } from "./S3StorageConfig.ts";
import { s3Storage } from "./s3Storage.ts";

/**
 * Shared test configuration for S3 storage adapter.
 * Uses MinIO for integration testing with unique buckets for isolation.
 */
export const s3StorageSharedTestConfig: SharedTestConfig = {
	name: s3Storage.name,
	requiresDocker: true,
	createEndpoint: createS3WithUniqueBucket,
};

export async function createS3WithUniqueBucket(
	options: { public?: boolean } = {},
): Promise<S3Endpoint> {
	const bucket = await createUniqueBucket(options);
	return createS3(MINIO_ENDPOINT, { bucket });
}

/**
 * Create an S3Endpoint with standard test configuration.
 */
export function createS3(endpoint: string, options: Partial<S3StorageConfig> = {}): S3Endpoint {
	return new S3Endpoint({
		endpoint,
		...options,
		bucket: options.bucket ?? "test-bucket",
		accessKey: options.accessKey ?? MINIO_ROOT_USER,
		secretKey: options.secretKey ?? MINIO_ROOT_PASSWORD,
	});
}

export async function createUniqueBucket(options: { public?: boolean } = {}): Promise<string> {
	await ensureDockerServicesRunning(["minio"]);
	const name = `aku-test-${randomId(10).toLowerCase()}`;
	await ensureBucketExists(name, options);
	return name;
}

/**
 * Ensure a bucket exists in MinIO, creating it if necessary.
 */
async function ensureBucketExists(
	bucketName: string,
	options: { public?: boolean } = {},
): Promise<void> {
	const client = new S3Client({
		endPoint: MINIO_ENDPOINT,
		accessKey: MINIO_ROOT_USER,
		secretKey: MINIO_ROOT_PASSWORD,
		region: "us-east-1",
	});

	const exists = await client.bucketExists(bucketName);
	if (!exists) {
		await client.makeBucket(bucketName);
	}

	if (options.public) {
		// Set bucket policy to allow public read access
		// Requires two statements: one for bucket metadata, one for objects
		const policy = {
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Principal: { AWS: ["*"] },
					Action: ["s3:GetBucketLocation", "s3:ListBucket"],
					Resource: [`arn:aws:s3:::${bucketName}`],
				},
				{
					Effect: "Allow",
					Principal: { AWS: ["*"] },
					Action: ["s3:GetObject"],
					Resource: [`arn:aws:s3:::${bucketName}/*`],
				},
			],
		};

		const headers = new Headers();
		headers.set("Content-Type", "application/json");

		try {
			await client.makeRequest({
				method: "PUT",
				objectName: "",
				bucketName,
				query: "policy",
				payload: JSON.stringify(policy),
				headers,
			});
		} catch (error) {
			// MinIO returns 204 No Content for successful policy set
			if (error instanceof S3Errors.ServerError && error.statusCode === 204) {
				// Success - 204 is acceptable
			} else {
				throw error;
			}
		}
	}
}
