declare global {
	// RegExp.escape is ES2025 but available in practice in all runtimes,
	// we can remove this when typescript releases the ES2025 lib option
	// https://github.com/microsoft/TypeScript/issues/61735
	interface RegExpConstructor {
		escape(str: string): string;
	}
}

export {};
