import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { ServiceProviderReference } from "./Application.ts";

/**
 * The configuration supplied to createApplication().
 */
export interface Configuration {
	/**
	 * A handler function that receives an HTTP request and returns a response.
	 *
	 * This is the main entry point for handling HTTP requests. The handler is
	 * called within a DI scope, so scoped services like `RequestLocals` are
	 * available.
	 *
	 * @example
	 * handler: (request) => new Response("hello")
	 *
	 * @example
	 * // With Hono:
	 * const hono = new Hono();
	 * handler: hono.fetch
	 */
	handler?: ((request: Request) => Response | Promise<Response>) | undefined;

	/**
	 * Service providers to register with the application.
	 */
	providers?: Array<ServiceProviderReference>;

	/**
	 * Application URL configuration for generating absolute URLs
	 *
	 * URL generation follows this precedence (highest to lowest priority):
	 * 1. Override config (overrideHost, overrideProtocol) - always used, ignores request
	 * 2. Request headers (X-Forwarded-*, Host) - from proxy or load balancer
	 * 3. Request URL - protocol, hostname, and port from the actual request
	 * 4. Default config (defaultHost, defaultProtocol) - fallback when request unavailable
	 */
	appUrl?: {
		/**
		 * Always use this host, regardless of request headers or URL.
		 * Hostname with optional port (e.g., 'example.com', 'api.example.com:8080').
		 * Must not contain protocol prefix or slashes.
		 */
		overrideHost?: string | undefined;

		/**
		 * Fallback host to use when request headers/URL are unavailable
		 * (e.g., generating URLs outside of request context).
		 * Hostname with optional port (e.g., 'example.com', 'api.example.com:8080').
		 * Must not contain protocol prefix or slashes.
		 */
		defaultHost?: string | undefined;

		/**
		 * Always use this protocol, regardless of request headers or URL.
		 * When set, this overrides X-Forwarded-Proto and request URL protocol.
		 */
		overrideProtocol?: "http" | "https" | undefined;

		/**
		 * Default protocol to use when unavailable from request headers or URL
		 * (e.g., generating URLs outside request context).
		 */
		defaultProtocol?: "http" | "https" | undefined;
	};

	/**
	 * Storage disk configuration.
	 *
	 * Ensure that you define the default disk. `storage.disk()` with no arguments
	 * returns the default disk, which is `'local'` unless overridden by the
	 * defaultDisk property.
	 *
	 * @example
	 * {
	 *   disks: {
	 *     local: filesystemStorage({ root: '/var/storage' }),
	 *     temp: memoryStorage({}),
	 *   }
	 * }
	 */
	disks?: Record<string, StorageAdapter | StorageEndpoint>;

	/**
	 * The default disk is returned from Storage.disk() and used when performing
	 * directory operations directly on the storage facade, e.g. Storage.allFiles()
	 *
	 * If no default disk is specified, the 'local' disk will be used
	 *
	 * @default 'local'
	 */
	defaultDisk?: string | undefined;

	/**
	 * Database adapter(s) for the application.
	 *
	 * @example
	 * // Single database
	 * {
	 *   database: sqliteDatabase({ path: './data/app.db', transactionRetry: true }),
	 * }
	 *
	 * @example
	 * // Multiple databases
	 * {
	 *   database: {
	 *     default: sqliteDatabase({ path: './data/app.db', transactionRetry: true }),
	 *     additional: {
	 *       analytics: postgresDatabase({ sql: postgres(...), transactionRetry: true }),
	 *     }
	 *   }
	 * }
	 */
	database?: DatabaseAdapter | DatabaseConfig | undefined;
}

export const Configuration: TypeToken<Configuration> =
	createTypeToken<Configuration>("Configuration");

// Re-imported types to avoid circular dependencies
import type { DatabaseAdapter, DatabaseConfig } from "../../database/DatabaseAdapter.ts";
import type { StorageAdapter, StorageEndpoint } from "../../storage/contracts/Storage.ts";
