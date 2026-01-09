import type { MiddlewareReference } from "./Middleware.ts";
import { StatusPagesMiddleware } from "./StatusPagesMiddleware.ts";

export const DEFAULT_MIDDLEWARE_PRIORITY: MiddlewareReference[] = [
	// Framework middleware will be added here
	// Examples: Session, Auth, CSRF, RateLimit, etc.
	StatusPagesMiddleware,
];
