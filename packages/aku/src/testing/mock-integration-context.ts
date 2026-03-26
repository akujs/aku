import type { IntegrationContext } from "../integrations/IntegrationContext.ts";

export const mockIntegrationContext = (options?: {
	request?: Request | undefined;
	headers?: Record<string, string> | undefined;
	cookies?: Record<string, string> | undefined;
}): IntegrationContext => {
	// Determine header handling
	let getRequestHeader: (name: string) => string | null;
	let getRequestHeaderNames: () => IterableIterator<string>;

	if (options?.request) {
		// Extract from Request object
		getRequestHeader = (name: string) => options.request!.headers.get(name);
		getRequestHeaderNames = () => options.request!.headers.keys();
	} else if (options?.headers) {
		// Use custom header map
		getRequestHeader = (name: string) => options.headers![name] ?? null;
		getRequestHeaderNames = () => Object.keys(options.headers!)[Symbol.iterator]();
	} else {
		// Default: return null/empty
		getRequestHeader = () => null;
		getRequestHeaderNames = () => [][Symbol.iterator]();
	}

	// Determine cookie handling
	let getCookie: (name: string) => string | null;
	let getCookieNames: () => string[];

	if (options?.cookies) {
		getCookie = (name: string) => options.cookies![name] ?? null;
		getCookieNames = () => Object.keys(options.cookies!);
	} else {
		getCookie = () => null;
		getCookieNames = () => [];
	}

	return {
		context: "test",
		getCookie,
		getCookieNames,
		deleteCookie: () => {},
		setCookie: null,
		getRequestHeader,
		getRequestHeaderNames,
		addKeepAliveTask: () => {},
	};
};
