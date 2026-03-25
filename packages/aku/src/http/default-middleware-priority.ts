import type { MiddlewareReference } from "./Middleware.ts";

export const DEFAULT_MIDDLEWARE_PRIORITY: MiddlewareReference[] = [
	// Framework middleware will be added here
	// Examples: Session, Auth, CSRF, RateLimit, etc.
];
