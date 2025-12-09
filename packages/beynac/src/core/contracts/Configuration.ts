import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { MiddlewareReference } from "../../http/Middleware.ts";
import type { MiddlewarePriorityBuilder } from "../../http/MiddlewarePriorityBuilder.ts";
import type { ServiceProviderReference } from "./Application.ts";

/**
 * The configuration supplied to createApplication().
 */
export interface Configuration<RouteParams extends Record<string, string> = {}> {
	/**
	 * Enable development mode.
	 *
	 * WARNING! This is insecure, reveals sensitive information, is slower, and
	 * leaks memory. Never enable it in production. Among the effects are:
	 * disabling secure cookies and required HTTPS, providing detailed error
	 * messages in the browser that may contain sensitive information, and
	 * retaining log messages in memory.
	 *
	 * @default false
	 */
	development?: boolean | undefined;

	/**
	 * Route definitions for the application
	 */
	routes?: Routes<RouteParams>;

	/**
	 * Service providers to register with the application.
	 */
	providers?: Array<ServiceProviderReference>;

	/**
	 * Configure middleware execution priority.
	 *
	 * Middleware in the priority list will be moved to the front of the
	 * middleware list and execute in the specified order, regardless of the order
	 * they're assigned to routes.
	 *
	 * Can be:
	 * - An array of middleware classes (replaces default priority)
	 * - A function that receives a builder to modify the default priority
	 *
	 * @example
	 * // Replace default priority
	 * middlewarePriority: [Auth, RateLimit, Logger]
	 *
	 * @example
	 * // Modify default priority
	 * middlewarePriority: (builder) => {
	 *   builder.addBefore(SetupTenant, Auth);
	 *   builder.addAfter(CustomLogger, Session);
	 *   builder.remove(DefaultRateLimit);
	 * }
	 */
	middlewarePriority?: MiddlewareReference[] | ((builder: MiddlewarePriorityBuilder) => void);

	/**
	 * Development mode options
	 */
	devMode?: {
		/**
		 * Suppress automatic page refresh in development mode
		 */
		autoRefresh?: boolean;

		/**
		 * List of absolute file paths to folders to watch for changes. If undefined, `process.cwd()` will be used
		 */
		autoRefreshPaths?: string[];

		/**
		 * Regular expression to match against the full paths of any changed files
		 * in `autoRefreshPaths`
		 *
		 * @default /\bbeynac\b/i
		 */
		autoRefreshPathPattern?: RegExp;

		/**
		 * To avoid reloading while files are still being written, auto-refresh will
		 * wait until this number of milliseconds before reloading the page.
		 *
		 * @default 300
		 */
		autoRefreshDebounceMs?: number;

		/**
		 * How often to send heartbeat messages over the SSE connection to keep it alive
		 * through proxies and load balancers
		 *
		 * @default 15000 (15 seconds)
		 */
		autoRefreshHeartbeatMs?: number;
	};

	/**
	 * Control when to throw errors on accessing non-existent route parameters.
	 *
	 * - 'always': Always throw when accessing invalid parameters
	 * - 'never': Never throw, return undefined (production-like behavior)
	 * - 'development': Throw only when development mode is enabled
	 * - 'production': Throw only when development mode is disabled
	 *
	 * @default 'always'
	 */
	throwOnInvalidParamAccess?: EnvironmentChoice | undefined;

	/**
	 * Control when to use streaming responses for rendering.
	 *
	 * When enabled, responses are streamed to the client as content is generated,
	 * which can improve time-to-first-byte. When disabled, the entire response is
	 * buffered before sending.
	 *
	 * Note: When streaming responses, the headers will be sent before the
	 * whole response is generated, so template components cannot set headers
	 * and cookies.
	 *
	 * - 'always': Always use streaming responses
	 * - 'never': Never use streaming, always buffer
	 * - 'development': Stream only when development mode is enabled
	 * - 'production': Stream only when development mode is disabled
	 *
	 * @default 'always'
	 */
	streamResponses?: EnvironmentChoice | undefined;

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
	 * Database adapter for the application.
	 *
	 * @example
	 * {
	 *   database: sqliteDatabase({ path: './data/app.db' }),
	 * }
	 */
	database?: DatabaseAdapter | undefined;
}

export const Configuration: TypeToken<Configuration> =
	createTypeToken<Configuration>("Configuration");

export type EnvironmentChoice = "always" | "never" | "development" | "production";

export function resolveEnvironmentChoice(
	value: EnvironmentChoice | undefined,
	defaultValue: EnvironmentChoice,
	isDevelopment: boolean,
): boolean {
	const choice = value ?? defaultValue;
	switch (choice) {
		case "always":
			return true;
		case "never":
			return false;
		case "development":
			return isDevelopment;
		case "production":
			return !isDevelopment;
	}
}

// Re-imported types to avoid circular dependencies
import type { DatabaseAdapter } from "../../database/DatabaseAdapter.ts";
import type { Routes } from "../../http/router-types.ts";
import type { StorageAdapter, StorageEndpoint } from "../../storage/contracts/Storage.ts";
