/**
 * Ambient module declarations for Next.js subpath imports.
 *
 * Next.js doesn't have an "exports" field in its package.json, which means
 * TypeScript with moduleResolution: "nodenext" cannot resolve subpath imports
 * like "next/headers" or "next/server".
 *
 * This is a known issue: https://github.com/vercel/next.js/issues/46078
 *
 * These declarations provide the type information that TypeScript needs.
 * Types are declared inline based on Next.js's actual type definitions.
 */

declare module "next/headers" {
	interface ReadonlyRequestCookies {
		get(name: string): { name: string; value: string } | undefined;
		getAll(): Array<{ name: string; value: string }>;
		has(name: string): boolean;
		set(name: string, value: string, options?: CookieOptions): void;
		delete(name: string): void;
	}

	interface CookieOptions {
		domain?: string | undefined;
		expires?: Date | undefined;
		httpOnly?: boolean | undefined;
		maxAge?: number | undefined;
		path?: string | undefined;
		partitioned?: boolean | undefined;
		sameSite?: true | false | "lax" | "strict" | "none" | undefined;
		secure?: boolean | undefined;
	}

	interface ReadonlyHeaders {
		get(name: string): string | null;
		has(name: string): boolean;
		keys(): IterableIterator<string>;
		values(): IterableIterator<string>;
		entries(): IterableIterator<[string, string]>;
		forEach(callback: (value: string, key: string) => void): void;
	}

	export function cookies(): Promise<ReadonlyRequestCookies>;
	export function headers(): Promise<ReadonlyHeaders>;
}

declare module "next/server" {
	type AfterTask<T = unknown> = Promise<T> | (() => T | Promise<T>);

	export function after<T>(task: AfterTask<T>): void;
}
