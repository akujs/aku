/***/
export interface S3StorageConfig {
	/**
	 * The base S3 endpoint URL.
	 *
	 * For AWS URLs, the endpoint domain name should include the region, so that
	 * the `regionForSigning` can be automatically extracted.
	 *
	 * Examples:
	 * - "https://s3.us-east-1.amazonaws.com"
	 * - "https://<accountid>.r2.cloudflarestorage.com/"
	 */
	endpoint: string;

	/**
	 * The bucket name to use for this disk.
	 */
	bucket: string;

	/**
	 * AWS Access Key ID or equivalent for S3-compatible services.
	 *
	 * Used for authenticating requests and signing URLs.
	 */
	accessKey: string;

	/**
	 * AWS Secret Access Key or equivalent for S3-compatible services.
	 *
	 * Used for authenticating requests and signing URLs.
	 */
	secretKey: string;

	/**
	 * Region to use for AWS Signature V4 request signing.
	 *
	 * You should not need to set this normally, because by default:
	 *   - For AWS S3 endpoints, the the AWS region is extracted from the endpoint URL
	 *   - For non-AWS s3-compatible endpoints, the value is defaulted to 'auto', since most
	 *     such services ignore the signature region
	 */
	regionForSigning?: string;

	/**
	 * Session token for AWS temporary credentials (STS/IAM roles).
	 *
	 * Only required when using temporary credentials such as those obtained
	 * from AWS Security Token Service (STS).
	 */
	sessionToken?: string;

	/**
	 * URL style for constructing bucket URLs.
	 *
	 * - "subdomain": Bucket name in host, e.g.
	 *                https://my-bucket.s3.us-east-1.amazonaws.com/object-key
	 *                Encouraged by AWS for performance, but not supported by
	 *                most non-AWS S3-compatible services.
	 *
	 * - "path": Bucket name in path, e.g.
	 *           https://s3.us-east-1.amazonaws.com/my-bucket/object-key
	 *
	 * Defaults to:
	 * - "subdomain" for AWS endpoints (*.amazonaws.com)
	 * - "path" for other S3-compatible services
	 */
	bucketUrlStyle?: "path" | "subdomain";
}
