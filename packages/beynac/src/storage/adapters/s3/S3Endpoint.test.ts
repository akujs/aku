import { describe, expect, test } from "bun:test";
import { MINIO_ENDPOINT, shouldSkipDockerTests } from "../../../test-utils/docker.bun.ts";
import { mockCurrentTime, resetMockTime } from "../../../testing/mock-time.ts";
import { PermissionsError } from "../../storage-errors.ts";
import {
	createS3,
	createS3WithUniqueBucket,
	createUniqueBucket,
} from "./S3Endpoint.shared.test.ts";
import { s3Storage } from "./s3Storage.ts";

describe.skipIf(shouldSkipDockerTests())(s3Storage, () => {
	describe("S3-specific configuration", () => {
		test("AWS endpoint with region in URL - extracts region automatically", () => {
			const endpoint = createS3("https://s3.us-west-2.amazonaws.com");

			expect(endpoint.regionForSigning).toBe("us-west-2");
		});

		test("AWS endpoint with dualstack format - extracts region automatically", () => {
			const endpoint = createS3("https://s3.dualstack.eu-west-1.amazonaws.com");

			expect(endpoint.regionForSigning).toBe("eu-west-1");
		});

		test("AWS endpoint without region throws error if regionForSigning not provided", () => {
			expect(() => {
				createS3("https://example.amazonaws.com");
			}).toThrow(/AWS endpoint URLs must either use the format/);
		});

		test("AWS endpoint without region works if regionForSigning provided", () => {
			const endpoint = createS3("https://example.amazonaws.com", {
				regionForSigning: "eu-west-1",
			});

			expect(endpoint.regionForSigning).toBe("eu-west-1");
		});

		test("non-AWS endpoint defaults to 'auto' region", () => {
			const endpoint = createS3("http://localhost:9000");

			expect(endpoint.regionForSigning).toBe("auto");
		});

		test("non-AWS endpoint can specify custom region", () => {
			const endpoint = createS3("http://localhost:9000", {
				regionForSigning: "custom-region",
			});

			expect(endpoint.regionForSigning).toBe("custom-region");
		});

		test("invalid endpoint URL throws TypeError", () => {
			expect(() => {
				createS3("not-a-valid-url");
			}).toThrow(TypeError);
		});

		test("bucketUrlStyle defaults to subdomain for AWS endpoints", () => {
			const endpoint = createS3("https://s3.us-east-1.amazonaws.com");
			expect(endpoint.bucketUrlStyle).toBe("subdomain");
		});

		test("bucketUrlStyle defaults to path for non-AWS endpoints", () => {
			const endpoint = createS3("http://localhost:9000");
			expect(endpoint.bucketUrlStyle).toBe("path");
		});

		test("bucketUrlStyle can be explicitly set", () => {
			const pathStyle = createS3("https://s3.us-east-1.amazonaws.com", {
				bucketUrlStyle: "path",
			});

			const subdomainStyle = createS3("http://localhost:9000", {
				bucketUrlStyle: "subdomain",
			});

			expect(pathStyle.bucketUrlStyle).toBe("path");
			expect(subdomainStyle.bucketUrlStyle).toBe("subdomain");
		});

		test("path-style URLs preserve endpoint path prefix without trailing slash", async () => {
			const endpoint = createS3("http://example.com/base/path", {
				bucketUrlStyle: "path",
			});

			const url = await endpoint.getPublicDownloadUrl("/file.txt");

			expect(url).toBe("http://example.com/base/path/test-bucket/file.txt");
		});

		test("path-style URLs preserve endpoint path prefix with trailing slash", async () => {
			const endpoint = createS3("http://example.com/base/path/", {
				bucketUrlStyle: "path",
			});

			const url = await endpoint.getPublicDownloadUrl("/file.txt");

			expect(url).toBe("http://example.com/base/path/test-bucket/file.txt");
		});

		test("sessionToken is provided to the client", () => {
			const withoutToken = createS3("https://s3.us-east-1.amazonaws.com");

			const withToken = createS3("https://s3.us-east-1.amazonaws.com", {
				sessionToken: "temporary-token",
			});

			expect(withoutToken.client.sessionToken).toBeUndefined();
			expect(withToken.client.sessionToken).toBe("temporary-token");
		});

		test("invalidNameChars is empty for S3", () => {
			const endpoint = createS3("http://localhost:9000");
			expect(endpoint.invalidNameChars).toBe("");
		});
	});

	describe("S3-specific behavior with MinIO", () => {
		test("supports special characters in filenames", async () => {
			const endpoint = await createS3WithUniqueBucket();

			// S3 supports most special characters
			const specialPaths = [
				"/file with spaces.txt",
				"/文件.txt", // Chinese characters
			];

			for (const path of specialPaths) {
				await endpoint.writeSingle({
					path,
					data: "test content",
					mimeType: "text/plain",
				});

				expect(await endpoint.existsSingle(path)).toBe(true);
			}
		});

		test("public URL is accessible", async () => {
			const endpoint = await createS3WithUniqueBucket({ public: true });

			await endpoint.writeSingle({
				path: "/test-file.txt",
				data: "test content",
				mimeType: "text/plain",
			});

			const url = await endpoint.getPublicDownloadUrl("/test-file.txt");

			const response = await fetch(url);
			expect(response.ok).toBe(true);

			const content = await response.text();
			expect(content).toBe("test content");
		});

		test("public URL with download filename", async () => {
			const endpoint = await createS3WithUniqueBucket({ public: true });

			await endpoint.writeSingle({
				path: "/test-file.txt",
				data: "test content",
				mimeType: "text/plain",
			});

			const url = await endpoint.getPublicDownloadUrl("/test-file.txt", {
				downloadAs: "custom-name.txt",
			});

			const response = await fetch(url);
			expect(response.ok, `Should be able to access ${url}`).toBe(true);
			expect(response.headers.get("Content-Disposition")).toBe(
				'attachment; filename="custom-name.txt"',
			);
		});

		test("signed URL generation works", async () => {
			const endpoint = await createS3WithUniqueBucket();

			await endpoint.writeSingle({
				path: "/signed-test.txt",
				data: "signed content",
				mimeType: "text/plain",
			});

			const expires = new Date(Date.now() + 60 * 60 * 1000);
			const signedUrl = await endpoint.getSignedDownloadUrl("/signed-test.txt", { expires });

			expect(signedUrl).toBeDefined();
			expect(signedUrl).toContain("X-Amz-");

			// Verify the signed URL works by fetching it
			const response = await fetch(signedUrl);
			expect(response.ok).toBe(true);

			const content = await response.text();
			expect(content).toBe("signed content");
		});

		test("signed URL with download filename", async () => {
			const endpoint = await createS3WithUniqueBucket();

			await endpoint.writeSingle({
				path: "/download-test.txt",
				data: "download content",
				mimeType: "text/plain",
			});

			const expires = new Date(Date.now() + 60 * 60 * 1000);
			const signedUrl = await endpoint.getSignedDownloadUrl("/download-test.txt", {
				expires,
				downloadAs: "custom-download.txt",
			});

			expect(signedUrl).toContain("response-content-disposition");
			expect(signedUrl).toContain("custom-download.txt");

			const response = await fetch(signedUrl);
			expect(response.ok).toBe(true);

			const contentDisposition = response.headers.get("Content-Disposition");
			expect(contentDisposition).toContain("custom-download.txt");

			const content = await response.text();
			expect(content).toBe("download content");
		});

		test("upload URL generation works", async () => {
			const endpoint = await createS3WithUniqueBucket();

			const expires = new Date(Date.now() + 60 * 60 * 1000);
			const uploadUrl = await endpoint.getTemporaryUploadUrl("/upload-test.txt", expires);

			const uploadResponse = await fetch(uploadUrl, {
				method: "PUT",
				body: "uploaded content",
				headers: {
					"Content-Type": "text/plain",
				},
			});
			expect(uploadResponse.ok).toBe(true);

			const result = await endpoint.readSingle("/upload-test.txt");
			const content = await new Response(result.data).text();
			expect(content).toBe("uploaded content");
		});

		test("expired upload URL gives permissions error", async () => {
			const endpoint = await createS3WithUniqueBucket();

			// Mock time to be in the past, to get around the library clamping time to valid range
			const pastTime = new Date(Date.now() - 5000);
			mockCurrentTime(pastTime);
			const uploadUrl = await endpoint.getTemporaryUploadUrl("/upload-test.txt", pastTime);

			// Restore real time - URL is now expired
			resetMockTime();

			const uploadResponse = await fetch(uploadUrl, {
				method: "PUT",
				body: "uploaded content",
				headers: {
					"Content-Type": "text/plain",
				},
			});
			expect(uploadResponse.ok).toBe(false);
			expect(uploadResponse.status).toBe(403);
		});

		test("invalid credentials throw PermissionsError", async () => {
			const bucket = await createUniqueBucket();

			const endpoint = createS3(MINIO_ENDPOINT, {
				bucket,
				accessKey: "invalid-key",
				secretKey: "invalid-secret",
			});

			expect(endpoint.readSingle("/any-file.txt")).rejects.toThrow(PermissionsError);
		});
	});
});
