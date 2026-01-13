/**
 * Configuration for the memory adapter
 */
export interface MemoryStorageConfig {
	/**
	 * Pre-populate the storage with initial files. Useful for test fixtures.
	 *
	 * Values can be:
	 * - A string (mimeType defaults to "text/plain")
	 * - An object with data and optional mimeType
	 *
	 * @example
	 * initialFiles: {
	 *   'readme.txt': 'Hello world',
	 *   'users/avatar.png': { data: avatarBytes },
	 * }
	 */
	initialFiles?:
		| Record<
				string,
				| string
				| {
						data: string | ArrayBuffer | ArrayBufferView | null | undefined;
						mimeType?: string | null | undefined;
				  }
		  >
		| undefined;

	/**
	 * Whether to declare support for mime types. Useful to simulate non
	 * mime-type compatible storage for testing.
	 *
	 * @default true
	 */
	supportsMimeTypes?: boolean | undefined;

	/**
	 * Declare filenames that are invalid for this adapter. Useful to simulate
	 * storage that doesn't allow certain file names for testing.
	 *
	 * @example
	 * invalidNameChars: '<>:"/\\|?*' // Windows-style restrictions
	 */
	invalidNameChars?: string | undefined;

	/**
	 * By default, url methods on a memoryStorage disk will throw. Pass true to
	 * return fake `memory://` URLs for testing.
	 *
	 * @default false
	 */
	fakeUrls?: boolean | undefined;
}
