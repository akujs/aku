import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { JSXNode, RenderOptions } from "../view-types.ts";

export type RenderResponseOptions = {
	readonly status?: number | undefined;
	readonly headers?: RequestInit["headers"] | undefined;
	readonly streaming?: boolean | undefined;
} & RenderOptions;

/**
 * Provides methods to render JSX and html`` template string content.
 */
export interface ViewRenderer {
	/**
	 * Renders content to a complete HTML/XML string.
	 * This is a convenience wrapper around renderStream that collects all chunks.
	 *
	 * @param node - The content tree to render, e.g. <jsx>...</jsx> or html`...`
	 * @param options.mode - Whether to render as "html" (default) or "xml"
	 *
	 * @example
	 * ```ts
	 * const html = await render(<div>Hello World</div>);
	 * console.log(html); // "<div>Hello World</div>"
	 * ```
	 */
	render(node: JSXNode, options?: RenderOptions): Promise<string>;

	/**
	 * Renders content to a Response object for use in request handlers.
	 *
	 * @param node - The content tree to render, e.g. <jsx>...</jsx> or html`...`
	 * @param options - Response options (status, headers, etc.) and render options (mode, context)
	 * @param options.streaming - If true, streams content as it's rendered. If false/undefined, buffers the entire response.
	 *
	 * @example
	 * ```ts
	 * return await renderResponse(<div>Hello World</div>, { status: 200 });
	 * ```
	 */
	renderResponse(node: JSXNode, options?: RenderResponseOptions): Promise<Response>;

	/**
	 * Renders content to an async generator that yields HTML/XML strings.
	 * This enables streaming responses where content is sent to the client as it's generated.
	 *
	 * @param node - The content tree to render, e.g. <jsx>...</jsx> or html`...`
	 * @param options.mode - Whether to render as "html" (default) or "xml"
	 * @yields HTML/XML string chunks as they're generated
	 *
	 * @example
	 * ```ts
	 * for await (const chunk of renderStream(<div>Hello</div>)) {
	 *   response.write(chunk);
	 * }
	 * ```
	 */
	renderStream(node: JSXNode, options?: RenderOptions): AsyncGenerator<string>;
}

/***/
export const ViewRenderer: TypeToken<ViewRenderer> = createTypeToken("ViewRenderer");
