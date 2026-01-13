import { uneval } from "devalue";

/**
 * Serializes a JavaScript value for safe embedding in HTML script tags.
 * Returns a string that, when evaluated, recreates the original value.
 * Handles circular references and properly escapes </script> tags.
 *
 * @param value - Any JavaScript value to serialize
 * @returns A string in the format "(0, eval)('...')" that can be embedded in HTML
 *
 * @example
 * ```typescript
 * const obj = { a: 1 };
 * obj.self = obj; // circular reference
 *
 * const html = `<script>
 *   const myValue = ${jsFrom(obj)};
 * </script>`;
 * ```
 */
export function jsFrom(value: unknown): string {
	const serialized = uneval(value);
	// The (0, eval) pattern ensures evaluation in global scope
	// Wrap in parentheses to ensure it's a valid expression
	return `(0, eval)(${JSON.stringify(`(${serialized})`)})`;
}
