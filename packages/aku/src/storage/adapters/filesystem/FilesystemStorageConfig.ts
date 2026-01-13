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
	 * Configuration for generating public download URLs.
	 *
	 * Can be either a string prefix or a function that generates URLs.
	 *
	 * If not provided, getPublicDownloadUrl() will throw an error.
	 *
	 * @example
	 * // String prefix
	 * makePublicUrlWith: "https://cdn.example.com/files"
	 *
	 * @example
	 * // Custom URL generation function
	 * makePublicUrlWith: (path) => `https://cdn.example.com${path}?v=${Date.now()}`
	 */
	makePublicUrlWith?: string | ((path: string) => string) | undefined;

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
