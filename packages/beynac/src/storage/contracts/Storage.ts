import { createTypeToken, type TypeToken } from "../../container/container-key.ts";
import type { Container } from "../../container/contracts/Container.ts";

/**
 * A manager for storage disks
 *
 * Directory operations like allFiles() can be used on this object and will be
 * sent to the default disk
 */
export interface Storage extends StorageDirectoryOperations {
	/**
	 * Resolve a disk by name. If no name is provided, the default disk will be used.
	 */
	disk(name?: string): StorageDisk;

	/**
	 * Create a new disk at runtime. Useful for one-off operations, e.g.
	 * uploading a file to an S3 that was not specified in your application
	 * configuration
	 *
	 * @param endpoint a storage adapter e.g. filesystemStorage({... config ...})
	 * @param name an optional disk name for debugging
	 */
	build(endpoint: StorageAdapter | StorageEndpoint, name?: string): StorageDisk;

	/**
	 * Replace a disk with one backed by a temporary directory that will be
	 * cleaned up when the process exits.
	 */
	mock(diskName: string): void;

	/**
	 * Restore all mocked disks to their original endpoints.
	 */
	resetMocks(): void;
}

/**
 * A place that you can store files.
 *
 * Disks share the same API as directories, you can use all methods from the
 * StorageDirectory interface to access the root directory.
 *
 * @example
 * const disk = storage.disk('local');
 * const files = await disk.allFiles();
 * ```
 */
export interface StorageDisk extends StorageDirectoryOperations {
	readonly name: string;
	readonly endpoint: StorageEndpoint;
}

interface SignUrlOptions {
	/**
	 * Generate a signed URL with expiration on adapters that support it.
	 *
	 * Storage adapters may clamp the expiry range to an acceptable limit, for example s3
	 * supports at most 7 days.
	 *
	 * If you do not want your links to expire, just set a very far future
	 * expiration date.
	 *
	 * Strings can be in the format "1h" or "5d4h", and represent A time
	 * duration in the future after the URL is generated. Supported units are y,
	 * m, d, h, s, and ms units.
	 */
	expires?: string | Date | undefined;
}

interface DownloadUrlOptions {
	/**
	 * Set the download file name on adapters that support it (s3). Other
	 * adapters will ignore the option.
	 *
	 * This sets a header `Content-Disposition: attachment; filename="[value of downloadAs]"` on the response.
	 */
	downloadAs?: string | undefined;
}

type StorageFileSizeAndMime = {
	/**
	 * The size of the file in bytes.
	 */
	size: number;

	/**
	 * The mime type of the file. If the adapter did not provide a mime type, one
	 * will be inferred from the file extension or it will default to
	 * "application/octet-stream" for files with no or unknown extension.
	 */
	mimeType: string;

	/**
	 * The mime type reported by the server.
	 */
	originalMimeType: string | null;
};

/***/
export interface StorageFileInfo extends StorageFileSizeAndMime {
	/**
	 * The file etag if available. S3 provides an etag with get() responses,
	 * filesystem adapters do not. If the etag is not available in the get()
	 * response it can be obtained with info()
	 */
	etag: string;
}

/***/
export interface StorageFileFetchResult extends StorageFileSizeAndMime {
	/**
	 * The file etag if available. S3 provides an etag with get() responses,
	 * filesystem adapters do not. If the etag is not available in the get()
	 * response it can be obtained with info()
	 */
	etag: string | null;

	/**
	 * A web-standard Response object like that returned from `get()` that can
	 * be read using methods like response.json(), or response.getReader().
	 *
	 * It will have Content-Length and Content-Type and ETag headers set.
	 */
	response: Response;
}

/***/
export type StorageFileUrlOptions = DownloadUrlOptions;

/***/
export type StorageFileSignedUrlOptions = SignUrlOptions & DownloadUrlOptions;

/***/
export type StorageFileUploadUrlOptions = SignUrlOptions;

/***/
export interface StorageFile {
	readonly type: "file";

	/**
	 * The disk that this file is on - all operations will be performed on this disk
	 */
	readonly disk: StorageDisk;

	/**
	 * The path of this file inside `disk`, beginning with a slash "/"
	 */
	readonly path: string;

	/**
	 * Delete the file, if it exists.
	 *
	 * This method will throw if it fails to delete the file, for example due
	 * to permissions errors. If the file does not exist, that
	 * is not considered an error.
	 */
	delete(): Promise<void>;

	/**
	 * Check if this file exists.
	 */
	exists(): Promise<boolean>;

	/**
	 * Get this file and return an object containing metadata and a web-standard
	 * Response object.
	 *
	 * Unlike the fetch() API, this method will only return a response on
	 * success. On failure, an appropriate kind of error will be thrown, e.g.
	 * NotFoundError or PermissionsError. So you do not need to check the
	 * response.ok property
	 */
	get(): Promise<StorageFileFetchResult>;

	/**
	 * Get the file content as text.
	 *
	 * This awaits get() and returns the response.text() property.
	 */
	getText(): Promise<string>;

	/**
	 * Get the file content parsed as JSON.
	 *
	 * This awaits get() and returns the response.json() property.
	 */
	getJson(): Promise<unknown>;

	/**
	 * Get the file content as binary data.
	 *
	 * This awaits get() and returns the response.arrayBuffer() property, wrapped in a Uint8Array.
	 */
	getUint8Array(): Promise<Uint8Array>;

	/**
	 * Get metadata on this file. Returns null if no file exists.
	 */
	info(): Promise<StorageFileInfo | null>;

	/**
	 * Get the URL at which this file can be accessed.
	 *
	 * This will be a regular unsigned URL and so relies on the file being publicly accessible.
	 *
	 * @param options.downloadAs - The suggested filename for the file, for s3. Storage adapters that do not support suggested download names will ignore this option.
	 */
	url(options?: DownloadUrlOptions): Promise<string>;

	/**
	 * Generate a signed URL to allow access to this file.
	 *
	 * Storage adapters may clamp the expiry range to an acceptable limit, for example s3
	 * supports at most 7 days.
	 *
	 * @param options.downloadAs - The suggested filename for the file, for s3. Storage adapters that do not support suggested download names will ignore this option.
	 * @param options.expires - A Date defining expiry time, or string in the format "1h" or "5d4h" representing a duration into the future
	 */
	signedUrl(options?: DownloadUrlOptions & SignUrlOptions): Promise<string>;

	/**
	 * Generate a URL that clients can POST data to to upload file content.
	 *
	 * Storage adapters may clamp the expiry range to an acceptable limit, for example s3
	 * supports at most 7 days.
	 *
	 * @param options.expires - A Date defining expiry time, or string in the format "1h" or "5d4h" representing a duration into the future
	 */
	uploadUrl(options?: SignUrlOptions): Promise<string>;

	/**
	 * Upload data to the file. If the file does not exist, it will be
	 * created. If the file exists, it will be overwritten.
	 *
	 * The file already has a name (its path), so this method does not
	 * accept a suggestedName. To upload a file with a suggested name that
	 * may be sanitised, use directory.putFile() instead.
	 *
	 * @param payload - can be one of:
	 *   - A source of binary data (string, Blob, ArrayBuffer, etc.) - mimeType will be inferred from the file path
	 *   - An object with { data, mimeType? } - mimeType is optional and will be inferred from file path if not provided
	 *   - A File object - mimeType will be obtained from the File's type property
	 *   - A Request object - mimeType will be obtained from the Content-Type header
	 *
	 * If you pass a File or Request object, the mimeType will be obtained
	 * from the Content-Type header or File type property. Otherwise, if mimeType
	 * is not explicitly provided, it will be inferred from the file path extension.
	 */
	put(payload: StorageData | StorageFilePutPayload | File | Request): Promise<void>;

	/**
	 * Copy the file to another location.
	 *
	 * If the destination is on the same disk, the copy is performed efficiently using
	 * the adapter's copy() method. Otherwise, the file is fetched and then written
	 * to the destination.
	 */
	copyTo(destination: StorageFile): Promise<void>;

	/**
	 * Move the file to another location.
	 *
	 * If the destination is on the same disk, the move is performed efficiently
	 * using the adapter's move() method. Otherwise, the file is copied to the
	 * destination and then deleted from the source.
	 *
	 * NOTE: s3 lacks a native move operation, so this method will copy the file
	 * to the destination and delete the source. Your application will briefly
	 * see temporarily see a state with two files present. If the delete fails
	 * for some reason, the copy will remain forever.
	 */
	moveTo(destination: StorageFile): Promise<void>;
}

/**
 * A source of binary data for uploading to storage.
 */
export type StorageData =
	| ReadableStream
	| Blob
	| FormData
	| URLSearchParams
	| string
	| ArrayBuffer
	// Using ArrayBufferView leads to type issues with Bun's types, so list every kind of view here
	| Int8Array
	| Uint8Array
	| Uint8ClampedArray
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| Float32Array
	| Float64Array
	| BigInt64Array
	| BigUint64Array
	| DataView;

/***/
export interface StorageFilePutPayload {
	data: StorageData;
	mimeType?: string | null | undefined;
}

/***/
export interface StorageDirectory extends StorageDirectoryOperations {
	readonly type: "directory";

	/**
	 * The disk that this directory is on - all operations will be performed on this disk
	 */
	readonly disk: StorageDisk;

	/**
	 * The path of this directory inside `disk`, beginning and ending with a slash "/"
	 */
	readonly path: string;
}

type FileSanitiseOptions = {
	onInvalid?: "convert" | "throw";
};

/***/
export type StorageFileListOptions = {
	/**
	 * Whether to list files recursively. If false, only immediate children
	 * will be returned.
	 */
	recursive?: boolean;
};

/***/
export interface StorageDirectoryOperations {
	/**
	 * Check if there are any files with this directory's prefix.
	 *
	 * NOTE: in Beynac, directories are simply references to a common prefix
	 * for files. There is no such thing as an empty directory. Checking if a
	 * directory exists is equivalent to checking whether there are any files
	 * with its prefix. When the last file is removed, the directory will
	 * cease to exist.
	 */
	exists(): Promise<boolean>;

	/**
	 * List direct child files and directories in alphabetical order.
	 */
	list(): Promise<Array<StorageFile | StorageDirectory>>;

	/**
	 * List direct child files and directories in alphabetical order.
	 *
	 * Stream results to avoid buffering the whole list in memory.
	 */
	listStreaming(): AsyncGenerator<StorageFile | StorageDirectory, void>;

	/**
	 * List child files in alphabetical order. By default, only direct children are returned.
	 *
	 * @param options.recursive - if true, include files in subdirectories in the results
	 */
	listFiles(options?: { recursive?: boolean }): Promise<Array<StorageFile>>;

	/**
	 * List child files in alphabetical order. By default, only direct children are returned.
	 *
	 * Stream results to avoid buffering the whole list in memory.
	 *
	 * @param options.recursive - if true, include files in subdirectories in the results
	 */
	listFilesStreaming(options?: { recursive?: boolean }): AsyncGenerator<StorageFile, void>;

	/**
	 * List direct child directories in alphabetical order.
	 */
	listDirectories(): Promise<Array<StorageDirectory>>;

	/**
	 * List direct child directories in alphabetical order.
	 *
	 * Stream results to avoid buffering the whole list in memory.
	 */
	listDirectoriesStreaming(): AsyncGenerator<StorageDirectory, void>;

	/**
	 * Delete all files within this directory, recursively.
	 *
	 * This is equivalent to deleting the directory, since in Beynac there is
	 * no concept of an empty directory.
	 */
	deleteAll(): Promise<void>;

	/**
	 * Return a directory reference by resolving a path relative to this
	 * directory.
	 *
	 * You can descend multiple directories in one call with
	 * directory("foo/bar/baz"). Windows-style paths like "foo\\bar\\baz" are
	 * also supported, and are converted to forward slashes.
	 *
	 * Paths are trimmed of leading and trailing whitespace and internal spaces
	 * converted to underscores.
	 *
	 * By default, handles invalid filenames by generating a unique valid
	 * filename. This can cause surprising results if you write files using this
	 * API then try to read them using a different system. For example, if you
	 * try to save a file called "test:file" to a filesystem that doesn't
	 * support colons, the file will be saved as "test_file-3c5b0673" (3c5b0673
	 * is a hash of the original name).
	 *
	 * @param options.onInvalid - "convert" to generate valid file names (the
	 *                            default), or "error" to throw an error
	 *
	 * @param path - a directory name e.g. "pokemon" or path e.g.
	 *               "pokemon/pikachu/images"
	 */
	directory(path: string, options?: FileSanitiseOptions): StorageDirectory;

	/**
	 * Return a file reference by resolving a path relative to this directory.
	 *
	 * Slashes in the filename are interpreted as directory names, so
	 * "foo/bar.txt" returns a file in the "foo" subdirectory. Windows-style paths
	 * like "foo\\bar.txt" are also supported, and are converted to forward slashes.
	 *
	 * Paths are trimmed of leading and trailing whitespace and internal spaces
	 * converted to underscores.
	 *
	 * By default, handles invalid filenames by generating a unique valid
	 * filename. This can cause surprising results if you write files using
	 * this API then try to read them using a different system. For example,
	 * if you try to save a file called "test:file" to a filesystem that
	 * doesn't support colons, the file will be saved as
	 * "test_file-3c5b0673" (3c5b0673 is a hash of the original name).
	 *
	 * @param options.onInvalid - "convert" to generate valid file names (the default), or "error" to throw an error
	 *
	 * @path a filename e.g. "image.png"
	 */
	file(path: string, options?: FileSanitiseOptions): StorageFile;

	/**
	 * Upload a file to this directory. The name may be changed to match the
	 * rules of the storage disk, removing invalid characters and adding a
	 * valid extension if required
	 *
	 * @param payload.data - a source of binary data
	 * @param payload.mimeType - a valid mime type e.g. "image/png"
	 * @param payload.suggestedName - optional suggested filename
	 *
	 * If you pass a File or Request object, the adapter will obtain a
	 * suggested name from the X-File-Name header or "filename" attribute of
	 * the Content-Disposition header, and a mimeType from the Content-Type header.
	 * Names from File or Request objects are trimmed of whitespace.
	 *
	 * @returns The StorageFile object with the actual filename used
	 */
	putFile(
		payload: (StorageFilePutPayload & { suggestedName?: string | undefined }) | File | Request,
	): Promise<StorageFile>;
}

/***/
export interface StorageEndpointWriteOptions {
	path: string;
	data: StorageData;
	mimeType: string | null;
}

/***/
export interface StorageEndpointFileInfoResult {
	contentLength: number;
	mimeType: string | null;
	etag: string;
}

/***/
export interface StorageEndpointFileReadResult {
	contentLength: number;
	mimeType: string | null;
	etag: string | null;
	data: StorageData;
}

/***/
export interface StorageAdapter {
	build(container: Container): StorageEndpoint;
}

/**
 * A connection to a specific storage location, e.g. a local directory or S3 bucket.
 */
export interface StorageEndpoint {
	/**
	 * Name of this endpoint for identification purposes (e.g. "memory", "s3", "filesystem")
	 */
	name: string;

	/**
	 * Read a file
	 *
	 * Should throw NotFoundError if the file does not exist, PermissionsError
	 * if the user doesn't have permission to read the file, or
	 * StorageUnknownError in other cases.
	 */
	readSingle(path: string): Promise<StorageEndpointFileReadResult>;

	/**
	 * Whether this endpoint supports MIME types. If it does not, then the
	 * Content-Type of readSingle() responses will be ignored and MIME type
	 * inferred from the file extension.
	 */
	supportsMimeTypes: boolean;

	/**
	 * A string containing chars that are invalid in filenames, e.g. `'<>:"/\\|?*'`
	 */
	invalidNameChars: string;

	/**
	 * Write a file.
	 *
	 * Should throw PermissionsError if the user doesn't have permission to
	 * write the file, or StorageUnknownError in other cases.
	 *
	 * @param options.path - the full absolute path of the file to write starting with a slash.
	 * @param options.data - a source of binary data confirming to the fetch BodyInit interface.
	 * @param options.mimetype - the file mime type or null if unknown.
	 */
	writeSingle(options: StorageEndpointWriteOptions): Promise<void>;

	/**
	 * Get information about a file. Should throw NotFoundError if the file does not exist.
	 */
	getInfoSingle(path: string): Promise<StorageEndpointFileInfoResult>;

	/**
	 * Get an unsigned URL that will work to download this file if it is public.
	 */
	getPublicDownloadUrl(path: string, downloadFileName?: string): Promise<string>;

	/**
	 * Get a temporary download URL for a path.
	 */
	getSignedDownloadUrl(path: string, expires: Date, downloadFileName?: string): Promise<string>;

	/**
	 * Get a temporary upload URL for a path.
	 */
	getTemporaryUploadUrl(path: string, expires: Date): Promise<string>;

	/**
	 * Copy a file internally within this endpoint. Should throw NotFoundError if the source file does not exist.
	 */
	copy(source: string, destination: string): Promise<void>;

	/**
	 * Copy a file internally within this endpoint. Should throw NotFoundError if the source file does not exist.
	 */
	move(source: string, destination: string): Promise<void>;

	/**
	 * Check if a file exists at the given path.
	 *
	 * If the file does not exist the implementation can either return false or throw a NotFoundError.
	 */
	existsSingle(path: string): Promise<boolean>;

	/**
	 * Check if any file exists under the given prefix
	 */
	existsAnyUnderPrefix(prefix: string): Promise<boolean>;

	/**
	 * List all files and directories that are immediately under a prefix. In
	 * filesystem terms the immediate file and directory children.
	 *
	 * The prefix will be a directory name ending with a forward slash. The
	 * prefix does not have to exist, in which case, there will be no results.
	 *
	 * The returned generator should yield paths relative to the prefix, in
	 * alphabetical order. Directory entries should end with a slash, file
	 * entries should not.
	 */
	listEntries(prefix: string): AsyncGenerator<string, void>;

	/**
	 * List all files under a prefix. In filesystem terms, this is a recursive
	 * search for files within directory tree starting at this directory.
	 *
	 * The prefix will be a directory name ending with a forward slash. The
	 * prefix does not have to exist, in which case, there will be no results.
	 *
	 * The returned generator should yield paths relative to the prefix, in
	 * alphabetical order.
	 */
	listFilesRecursive(prefix: string): AsyncGenerator<string, void>;

	/**
	 * Delete a single file.
	 *
	 * If the file does not exist the implementation must either return normally
	 * or throw a NotFoundError.
	 */
	deleteSingle(path: string): Promise<void>;

	/**
	 * Delete all files under a prefix.
	 *
	 * If the prefix does not exist the implementation must either return normally
	 * or throw a NotFoundError.
	 */
	deleteAllUnderPrefix(prefix: string): Promise<void>;
}

/***/
export const Storage: TypeToken<Storage> = createTypeToken("Storage");
