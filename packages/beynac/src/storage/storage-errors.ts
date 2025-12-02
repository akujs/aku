import { STATUS_CODES } from "node:http";
import { BeynacError } from "../core/core-errors.ts";
import type { StorageEndpoint } from "./contracts/Storage.ts";

/**
 * Base class for all storage-related errors
 */
export abstract class StorageError extends BeynacError {
	/**
	 * The underlying error that caused this storage error, if any.
	 */
	public override readonly cause?: Error | undefined;

	constructor(message: string, cause?: Error) {
		super(message);
		this.cause = cause;
	}
}

/**
 * Thrown when a requested disk is not found in the storage configuration.
 */
export class DiskNotFoundError extends StorageError {
	constructor(public readonly diskName: string) {
		super(`Disk "${diskName}" not found`);
	}
}

/**
 * Thrown when a path has an invalid format
 */
export class InvalidPathError extends StorageError {
	constructor(
		public readonly path: string,
		public readonly reason: string,
	) {
		super(`Invalid path "${path}": ${reason}`);
	}

	static forInvalidCharacters(path: string, endpoint: StorageEndpoint): InvalidPathError {
		return new InvalidPathError(
			path,
			`${endpoint.name} adapter does not allow ${endpoint.invalidNameChars} in names`,
		);
	}
}

/**
 * Thrown when a file is not found
 */
export class NotFoundError extends StorageError {
	constructor(public readonly path: string) {
		super(`File not found: ${path}`);
	}
}

/**
 * Thrown when permission is denied for a filesystem operation
 */
export class PermissionsError extends StorageError {
	constructor(
		public readonly path: string,
		public readonly code: number,
		public readonly errorName: string,
	) {
		super(`Permission denied (${code} ${errorName}): ${path}`);
	}

	static forHttpError(path: string, statusCode: number): PermissionsError {
		return new PermissionsError(path, statusCode, STATUS_CODES[statusCode] ?? "Unknown");
	}
}

/**
 * Thrown when a storage operation fails with an unexpected error. The cause is
 * available on the `cause` property.
 */
export class StorageUnknownError extends StorageError {
	constructor(
		public readonly operation: string,
		cause: unknown,
	) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		super(`Unable to ${operation}: ${error.message}`, error);
	}
}
