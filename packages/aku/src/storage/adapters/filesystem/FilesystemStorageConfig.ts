/**
 * Configuration for the filesystem adapter
 */
export interface FilesystemStorageConfig {
	/**
	 * Root directory where files are stored on disk.
	 * All storage paths will be relative to this directory.
	 */
	rootPath: string;

	/**
	 * Absolute or relative URL prefix for generating public file URLs.
	 * When generating a public URL for a file, this prefix is concatenated with the file's storage path.
	 *
	 * For example, if the prefix is "https://cdn.example.com/files" and the path is "/foo/bar.txt",
	 * the result will be "https://cdn.example.com/files/foo/bar.txt".
	 *
	 * @example
	 * // Absolute URL (CDN)
	 * publicUrlPrefix: "https://cdn.example.com/files"
	 */
	publicUrlPrefix?: string | undefined;

	/**
	 * Optional transformer function for public URLs.
	 *
	 * When provided, this function receives the URL (after prefix is applied)
	 * and can transform it. Useful for adding query parameters, versioning, etc.
	 *
	 * @example
	 * // Add cache-busting query parameter
	 * makePublicUrlWith: (url) => `${url}?v=${Date.now()}`
	 */
	makePublicUrlWith?: ((url: string) => string) | undefined;

	/**
	 * Function to generate signed download URLs.
	 *
	 * If not provided, signedUrl() will throw an error.
	 *
	 * @example
	 * makeSignedDownloadUrlWith: ({ path, expires, downloadFileName, config }) => {
	 *   const signature = generateHMAC(path + expires);
	 *   return `https://cdn.example.com${path}?expires=${expires}&sig=${signature}`;
	 * }
	 */
	makeSignedDownloadUrlWith?:
		| ((params: {
				path: string;
				expires: Date;
				downloadFileName?: string | undefined;
				config: FilesystemStorageConfig;
		  }) => string | Promise<string>)
		| undefined;

	/**
	 * Function to generate signed upload URLs.
	 *
	 * If not provided, uploadUrl() will throw an error.
	 *
	 * @example
	 * makeSignedUploadUrlWith: ({ path, expires, config }) => {
	 *   const signature = generateHMAC(path + expires);
	 *   return `https://cdn.example.com${path}?upload=true&expires=${expires}&sig=${signature}`;
	 * }
	 */
	makeSignedUploadUrlWith?:
		| ((params: {
				path: string;
				expires: Date;
				config: FilesystemStorageConfig;
		  }) => string | Promise<string>)
		| undefined;
}
