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
	readonly diskName: string;

	constructor(diskName: string) {
		super(`Disk "${diskName}" not found`);
		this.diskName = diskName;
	}
}

/**
 * Thrown when a path has an invalid format
 */
export class InvalidPathError extends StorageError {
	readonly path: string;
	readonly reason: string;

	constructor(path: string, reason: string) {
		super(`Invalid path "${path}": ${reason}`);
		this.path = path;
		this.reason = reason;
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
	readonly path: string;

	constructor(path: string) {
		super(`File not found: ${path}`);
		this.path = path;
	}
}

/**
 * Thrown when permission is denied for a filesystem operation
 */
export class PermissionsError extends StorageError {
	readonly path: string;
	readonly code: number;
	readonly errorName: string;

	constructor(path: string, code: number, errorName: string) {
		super(`Permission denied (${code} ${errorName}): ${path}`);
		this.path = path;
		this.code = code;
		this.errorName = errorName;
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
	readonly operation: string;

	constructor(operation: string, cause: unknown) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		super(`Unable to ${operation}: ${error.message}`, error);
		this.operation = operation;
	}
}
