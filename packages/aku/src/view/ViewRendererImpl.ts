import { Container } from "../container/contracts/Container.ts";
import { inject } from "../container/inject.ts";
import { BaseClass, withoutUndefinedValues } from "../utils.ts";
import { type Component, ComponentInstantiator, isClassComponent } from "./Component.ts";
import { type ClassAttributeValue, classAttribute } from "./class-attribute.ts";
import { ContextImpl } from "./context.ts";
import type { RenderResponseOptions, ViewRenderer } from "./contracts/ViewRenderer.ts";
import { MarkupStream } from "./markup-stream.ts";
import { isOnceNode, type OnceKey } from "./once.ts";
import { RawContent } from "./raw.ts";
import { isSpecialNode } from "./special-node.ts";
import { isStackOutNode, isStackPushNode } from "./stack.ts";
import { StreamBuffer } from "./stream-buffer.ts";
import { styleObjectToString } from "./style-attribute.ts";
import { type ErrorKind, RenderingError } from "./view-errors.ts";
import type { Props } from "./view-types.ts";
import {
	type Context,
	type CSSProperties,
	type JSXNode,
	type RenderOptions,
} from "./view-types.ts";

type ComponentStack = {
	name: string;
	parent: ComponentStack | null;
};

function throwRenderingError(
	errorKind: ErrorKind,
	componentStack: ComponentStack | null,
	cause: unknown,
): never {
	// Convert linked list to array for public API
	const stackArray: string[] = [];
	let node = componentStack;
	while (node) {
		stackArray.unshift(node.name);
		node = node.parent;
	}

	throw new RenderingError(errorKind, stackArray, cause);
}

const HTML_ESCAPE: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
};

const escapeHtml = (str: string) => str.replace(/[&<>"]/g, (ch) => HTML_ESCAPE[ch]);

const emptyTags = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

const booleanAttributes = new Set([
	"allowfullscreen",
	"async",
	"autofocus",
	"autoplay",
	"checked",
	"controls",
	"default",
	"defer",
	"disabled",
	"download",
	"formnovalidate",
	"hidden",
	"inert",
	"ismap",
	"itemscope",
	"loop",
	"multiple",
	"muted",
	"nomodule",
	"novalidate",
	"open",
	"playsinline",
	"readonly",
	"required",
	"reversed",
	"selected",
]);

function isReactElement(value: unknown): boolean {
	return (
		value != null &&
		typeof value === "object" &&
		"$$typeof" in value &&
		typeof value.$$typeof === "symbol"
	);
}

export class ViewRendererImpl extends BaseClass implements ViewRenderer {
	#container: Container;

	constructor(container: Container = inject(Container)) {
		super();
		this.#container = container;
	}

	async render(content: JSXNode, options?: RenderOptions): Promise<string> {
		let result = "";
		for await (const chunk of this.renderStream(content, options)) {
			result += chunk;
		}
		return result;
	}

	async renderResponse(
		content: JSXNode,
		{ mode, context, headers, status, streaming }: RenderResponseOptions = {},
	): Promise<Response> {
		if (!(headers instanceof Headers)) {
			headers = new Headers(headers);
		}

		if (!headers.has("content-type")) {
			headers.set(
				"content-type",
				mode === "xml" ? "application/xml; charset=utf-8" : "text/html; charset=utf-8",
			);
		}

		const responseInit = withoutUndefinedValues({ headers, status });

		if (streaming) {
			const renderStream = this.renderStream.bind(this);
			const stream = new ReadableStream({
				async start(controller) {
					try {
						for await (const chunk of renderStream(content, { mode, context })) {
							controller.enqueue(new TextEncoder().encode(chunk));
						}
						controller.close();
					} catch (error) {
						controller.error(error);
					}
				},
			});

			return new Response(stream, responseInit);
		}

		const html = await this.render(content, { mode, context });
		return new Response(html, responseInit);
	}

	renderStream(
		content: JSXNode,
		{ mode = "html", context }: RenderOptions = {},
	): AsyncGenerator<string> {
		const buf = new StreamBuffer();
		let rootContext: ContextImpl;
		if (context) {
			if (!(context instanceof ContextImpl)) {
				throw new Error("Invalid context");
			}
			rootContext = context;
		} else {
			rootContext = new ContextImpl();
			rootContext.set(ComponentInstantiator, (tag: Component, props: Props) => {
				if (isClassComponent(tag)) {
					// Instantiate using container.withInject() so inject() works in constructor
					const instance = this.#container.withInject(() => new tag(props));
					return (ctx: Context) => instance.render(ctx);
				}
				return (ctx: Context) => tag(props, ctx);
			});
		}
		const componentStack: ComponentStack | null = null;
		const onceKeys = new Set<OnceKey>(); // Track used Once keys
		const preExecuteResults = new Map<unknown, { result: JSXNode; context: ContextImpl }>(); // Cache function execution results with context
		const preExecuteInProgress = new Map<unknown, Promise<unknown>>(); // Track functions currently being pre-executed

		// Pre-execution rapidly visits the tree in parallel executing functions and
		// saving their results. This means that by the time the rendering phase has
		// got to a function it will usually have already been executed. The practical
		// effect of this is that when a document contains two components that require
		// data e.g. a database call, provided that the components are independent in
		// the tree, they will load data in parallel.
		const startPreExecution = (node: unknown, context: ContextImpl): void => {
			switch (typeof node) {
				case "object":
					if (node instanceof MarkupStream) {
						startPreExecution(node.content, context);
						return;
					}

					if (isSpecialNode(node)) {
						// Don't pre-execute Stack or Once nodes
						return;
					}

					// Handle arrays - start all in parallel
					if (Array.isArray(node)) {
						for (const item of node) {
							startPreExecution(item, context);
						}
						return;
					}

					// Handle standalone promises - just continue pre-execution on resolved value
					if (node instanceof Promise) {
						node.then(
							(resolved) => {
								startPreExecution(resolved, context);
							},
							() => {
								// Ignore errors
							},
						);
						return;
					}
					return;

				case "function":
					// Skip if already cached or in progress
					if (preExecuteResults.has(node) || preExecuteInProgress.has(node)) {
						return;
					}

					try {
						const childContext = context.fork();
						const result = (node as (ctx: Context) => JSXNode)(childContext);

						if (result instanceof Promise) {
							// For async functions, mark the function as in-progress and cache result when done
							const completionPromise = result.then(
								(resolved) => {
									const contextToUse = childContext.wasModified() ? childContext : context;
									// Store the original promise as result, but use context determined after resolution
									preExecuteResults.set(node, { result, context: contextToUse });
									preExecuteInProgress.delete(node); // Remove from in-progress
									startPreExecution(resolved as JSXNode, contextToUse);
								},
								() => {
									// Ignore errors in pre-execution
									preExecuteInProgress.delete(node); // Remove from in-progress even on error
								},
							);
							preExecuteInProgress.set(node, completionPromise);
						} else {
							// For sync functions, cache immediately
							const contextToUse = childContext.wasModified() ? childContext : context;
							preExecuteResults.set(node, { result, context: contextToUse });
							startPreExecution(result, contextToUse);
						}
					} catch {
						// Ignore errors during pre-execution
					}
					return;
			}
		};

		// Define rendering functions as closures that capture buf, mode, onceKeys, preExecuteResults, and preExecuteInProgress
		const renderNode = async (
			node: JSXNode,
			context: ContextImpl,
			stack: ComponentStack | null,
		): Promise<void> => {
			switch (typeof node) {
				case "symbol":
					buf.add(escapeHtml(String(node)));
					return;
				case "string":
					buf.add(escapeHtml(node));
					return;
				case "number":
				case "bigint":
					buf.add(String(node));
					return;
				case "boolean":
				case "undefined":
					return;
				case "object":
					if (node === null) return;
					if (isReactElement(node)) {
						throwRenderingError(
							"invalid-content",
							stack,
							new Error(
								'Encountered a React JSX element. Use Aku JSX instead, add /** @jsxImportSource aku/view **/ to the file containing the JSX, or configure your build system to use "aku/view" as a default JSX import source.',
							),
						);
					}
					if (isSpecialNode(node)) {
						if (node instanceof RawContent) {
							buf.add(node.toString());
							return;
						}
						if (isStackPushNode(node)) {
							// Handle Stack.Push: redirect content to stack buffer
							buf.beginRedirect(node.stackPush);
							for (const item of node) {
								await renderNode(item, context, stack);
							}
							buf.endRedirect();
							return;
						}
						if (isStackOutNode(node)) {
							// Handle Stack.Out: render buffered stack content
							buf.emitRedirectedContent(node.stackOut);
							return;
						}
						if (isOnceNode(node)) {
							// Handle Once: render content only if key hasn't been seen
							if (!onceKeys.has(node.onceKey)) {
								onceKeys.add(node.onceKey);
								for (const item of node) {
									await renderNode(item, context, stack);
								}
							}
							return;
						}
						throw new Error("Unrecognised special node");
					}
					if (Array.isArray(node)) {
						for (const item of node) {
							await renderNode(item as JSXNode, context, stack);
						}
						return;
					}
					if (node instanceof MarkupStream) {
						await renderMarkupStream(node, context, stack);
						return;
					}
					if (node instanceof Promise) {
						buf.yield();
						try {
							const resolved = (await node) as JSXNode;
							await renderNode(resolved, context, stack);
						} catch (error) {
							if (error instanceof RenderingError) {
								throw error;
							}
							throwRenderingError("content-promise-error", stack, error);
						}
						return;
					}

					buf.add(escapeHtml(String(node)));
					return;

				case "function":
					try {
						let result: JSXNode;
						let contextToUse: ContextImpl;

						// Wait for pre-execution if in progress
						const inProgress = preExecuteInProgress.get(node);
						if (inProgress) {
							await inProgress;
						}

						// Check if function was already executed in pre-execution
						const preExecuted = preExecuteResults.get(node);
						if (preExecuted) {
							result = preExecuted.result;
							contextToUse = preExecuted.context;

							if (result instanceof Promise) {
								buf.yield();
								try {
									const resolved = (await result) as JSXNode;
									await renderNode(resolved, contextToUse, stack);
								} catch (error) {
									throwRenderingError("content-function-promise-rejection", stack, error);
								}
							} else {
								await renderNode(result, contextToUse, stack);
							}
						} else {
							// Execute the function normally
							const childContext = context.fork();
							result = node(childContext) as JSXNode;

							if (result instanceof Promise) {
								buf.yield();
								try {
									const resolved = (await result) as JSXNode;
									// Check wasModified after promise resolves for async functions
									contextToUse = childContext.wasModified() ? childContext : context;
									await renderNode(resolved, contextToUse, stack);
								} catch (error) {
									throwRenderingError("content-function-promise-rejection", stack, error);
								}
							} else {
								// For sync functions, check wasModified immediately
								contextToUse = childContext.wasModified() ? childContext : context;
								await renderNode(result, contextToUse, stack);
							}
						}
					} catch (error) {
						if (error instanceof RenderingError) {
							throw error;
						}
						throwRenderingError("content-function-error", stack, error);
					}
					return;
			}
		};

		const renderMarkupStream = async (
			element: MarkupStream,
			context: ContextImpl,
			stack: ComponentStack | null,
		): Promise<void> => {
			const { tag, attributes, content, displayName } = element;
			const hasChildren = content && content.length > 0;

			// Push displayName to component stack if present
			const newStack = displayName ? { name: displayName, parent: stack } : stack;

			if (tag) {
				const isVoidElement = mode === "html" && emptyTags.has(tag);
				if (isVoidElement && hasChildren) {
					throwRenderingError(
						"attribute-type-error",
						newStack,
						new Error(`<${tag}> is a void element and must not have children`),
					);
				}

				const selfClosing = !isVoidElement && mode === "xml" && !hasChildren;
				try {
					renderOpeningTag(tag, attributes, selfClosing, newStack);
				} catch (error) {
					if (error instanceof RenderingError) {
						throw error;
					}
					throwRenderingError("attribute-type-error", newStack, error);
				}

				if (isVoidElement || selfClosing) {
					return;
				}
			}

			if (content) {
				for (const child of content) {
					await renderNode(child, context, newStack);
				}
			}

			if (tag) {
				renderClosingTag(tag);
			}
		};

		const renderOpeningTag = (
			tag: string,
			attributes: Record<string, unknown> | null,
			selfClosing: boolean,
			stack: ComponentStack | null,
		): void => {
			buf.add("<");
			buf.add(tag);

			if (attributes) {
				for (const [key, value] of Object.entries(attributes)) {
					if (value == null) {
						continue;
					}

					if (mode === "html" && booleanAttributes.has(key)) {
						if (value === true) {
							buf.add(" ");
							buf.add(key);
						} else if (value !== false) {
							buf.add(" ");
							buf.add(key);
							buf.add('="');
							buf.add(escapeHtml(String(value)));
							buf.add('"');
						}
					} else {
						// Validate attribute types that can't be serialized
						if (
							value instanceof Promise ||
							typeof value === "symbol" ||
							typeof value === "function"
						) {
							const valueType =
								value instanceof Promise
									? "Promise"
									: typeof value === "symbol"
										? "Symbol"
										: "Function";
							throwRenderingError(
								"attribute-type-error",
								stack,
								new Error(`Attribute "${key}" has an invalid value type: ${valueType}`),
							);
						}

						let stringValue: string;

						if (key === "style" && typeof value === "object" && value) {
							stringValue = styleObjectToString(value as CSSProperties);
							if (!stringValue) continue;
						} else if (key === "class" && (typeof value === "object" || Array.isArray(value))) {
							stringValue = classAttribute(value as ClassAttributeValue);
							if (!stringValue) continue;
						} else {
							stringValue = String(value);
						}

						buf.add(" ");
						buf.add(key);
						buf.add('="');
						buf.add(escapeHtml(stringValue));
						buf.add('"');
					}
				}
			}

			buf.add(selfClosing ? " />" : ">");
		};

		const renderClosingTag = (tag: string): void => {
			buf.add("</");
			buf.add(tag);
			buf.add(">");
		};

		// Start pre-execution traversal (non-blocking)
		startPreExecution(content, rootContext);

		// Start the rendering
		renderNode(content, rootContext, componentStack).then(
			() => buf.complete(),
			(error) => {
				buf.error(error as Error);
			},
		);

		return buf.stream();
	}
}
