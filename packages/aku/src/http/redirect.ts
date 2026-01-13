export type RedirectOptions = {
	/**
	 * Make a permanent redirect that instructs search engines to update their index to the new URL
	 *
	 * @default false
	 */
	permanent?: boolean;

	/**
	 * Preserve HTTP method so POST requests will result in a POST request to the new URL
	 *
	 * Note that this will involve the client re-uploading the request body which
	 * will significantly slow own large uploads.
	 *
	 * @default false
	 */
	preserveHttpMethod?: boolean;
};

export function redirectStatus(options?: RedirectOptions): number {
	if (options?.permanent) {
		return options?.preserveHttpMethod ? 308 : 301;
	}
	return options?.preserveHttpMethod ? 307 : 303;
}
