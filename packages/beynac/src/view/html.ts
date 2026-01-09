import { MarkupStream } from "./markup-stream.ts";
import { RawContent } from "./raw.ts";
import type { JSXNode } from "./view-types.ts";

/**
 * Render static HTML with optional dynamic values. This can be used anywhere
 * that JSX can be used, e.g. returned from controllers.
 *
 * Values inserted into the template string will be escaped. Use `raw(content)`
 * to for dynamically generated HTML.
 *
 * @example
 * const planetName = "<Earth>";
 * return html`<div>Hello ${planetName}</div>`;
 * // results in <div>Hello &lt;Earth&gt;</div>
 *
 * return html`<div>Hello ${raw(planetName)}</div>`;
 * // results in <div>Hello <Earth></div>
 *
 * return html`<div>Hello ${<b>World</b>}</div>`;
 * // Embedded JSX, results in <div>Hello <b>World</b></div>
 */
export function html(strings: TemplateStringsArray, ...values: JSXNode[]): MarkupStream {
	const content: JSXNode[] = [];

	for (let i = 0; i < strings.length; i++) {
		if (strings[i]) {
			// Template literal strings are treated as raw HTML (not escaped)
			content.push(new RawContent(strings[i]));
		}
		if (i < values.length) {
			// Interpolated values will be escaped by MarkupStream unless they're RawContent
			content.push(values[i]);
		}
	}

	return new MarkupStream(null, null, content);
}
