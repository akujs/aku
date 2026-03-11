/**
 * The CLI API version supported by this package. Increment this when the
 * contract between `@akujs/cli`'s `bin.mjs` and this entry point changes
 * (e.g. `runCli` signature changes, new required imports). Do not increment
 * for internal changes to `runCli` or new exports that `bin.mjs` doesn't use.
 */
export const CLI_API_VERSION: number = 1;
