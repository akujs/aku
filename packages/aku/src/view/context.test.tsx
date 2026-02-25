/** @jsxImportSource . */
import { describe, expect, expectTypeOf, test } from "bun:test";
import { createKey } from "../core/Key.ts";
import { render } from "../test-utils/view.test-utils.ts";
import { type Component } from "./Component.ts";
import { ContextImpl } from "./context.ts";
import { MarkupStream } from "./markup-stream.ts";
import { Once } from "./once.ts";
import type { Context, PropsWithChildren } from "./view-types.ts";

describe("basic operations", () => {
	test("get returns null for non-existent key", () => {
		const ctx = new ContextImpl();
		const testKey = createKey<string>({ displayName: "test" });
		expect(ctx.get(testKey)).toBeNull();
	});

	test("set and get work correctly", () => {
		const ctx = new ContextImpl();
		const testKey = createKey<string>({ displayName: "test" });
		ctx.set(testKey, "value");
		expect(ctx.get(testKey)).toBe("value");
	});

	test("get returns from local values after set is called", () => {
		const ctx = new ContextImpl();
		const key1 = createKey<string>({ displayName: "first" });
		const key2 = createKey<string>({ displayName: "second" });

		// Set initial value
		ctx.set(key1, "initial");

		// This should read from local values
		const val1 = ctx.get(key1);
		expect(val1).toBe("initial");

		// Set another value
		ctx.set(key2, "second");

		// Both should be accessible from local values
		expect(ctx.get(key1)).toBe("initial");
		expect(ctx.get(key2)).toBe("second");
	});
});

describe("fork behavior", () => {
	test("fork creates independent child contexts", () => {
		const ctx = new ContextImpl();
		const testKey = createKey<string>({ displayName: "test" });

		// Parent sets a value
		ctx.set(testKey, "parent");

		// Fork creates child
		const child1 = ctx.fork();
		const child2 = ctx.fork();

		// Children can read parent value
		expect(child1.get(testKey)).toBe("parent");
		expect(child2.get(testKey)).toBe("parent");

		// Child modifications don't affect parent or siblings
		child1.set(testKey, "child1");
		child2.set(testKey, "child2");

		expect(ctx.get(testKey)).toBe("parent");
		expect(child1.get(testKey)).toBe("child1");
		expect(child2.get(testKey)).toBe("child2");
	});

	test("fork inherits parent values", () => {
		const parent = new ContextImpl();
		const key1 = createKey<string>({ displayName: "key1" });
		const key2 = createKey<number>({ displayName: "key2" });

		parent.set(key1, "value1");
		parent.set(key2, 42);

		const child = parent.fork();

		expect(child.get(key1)).toBe("value1");
		expect(child.get(key2)).toBe(42);
	});

	test("child values override parent values", () => {
		const parent = new ContextImpl();
		const testKey = createKey<string>({ displayName: "test" });

		parent.set(testKey, "parent");

		const child = parent.fork();
		expect(child.get(testKey)).toBe("parent");

		child.set(testKey, "child");
		expect(child.get(testKey)).toBe("child");
		expect(parent.get(testKey)).toBe("parent"); // Parent unchanged
	});

	test("wasModified tracks modifications", () => {
		const ctx = new ContextImpl();
		const testKey = createKey<string>({ displayName: "test" });

		expect(ctx.wasModified()).toBe(false);

		ctx.set(testKey, "value");
		expect(ctx.wasModified()).toBe(true);

		const child = ctx.fork();
		expect(child.wasModified()).toBe(false);

		child.set(testKey, "child");
		expect(child.wasModified()).toBe(true);
	});
});

describe("context get with defaults", () => {
	test("returns default when key not set", () => {
		const ctx = new ContextImpl();
		const keyWithDefault = createKey<string>({
			displayName: "test",
			default: "defaultValue",
		});
		const result = ctx.get(keyWithDefault);
		expect(result).toBe("defaultValue");
	});

	test("returns set value over default", () => {
		const ctx = new ContextImpl();
		const keyWithDefault = createKey({
			displayName: "test",
			default: "defaultValue",
		});
		ctx.set(keyWithDefault, "setValue");
		const result = ctx.get(keyWithDefault);
		expect(result).toBe("setValue");
	});

	test("returns null for key without default", () => {
		const ctx = new ContextImpl();
		const keyWithoutDefault = createKey<string>({ displayName: "test" });
		const result = ctx.get(keyWithoutDefault);
		expect(result).toBeNull();
	});

	test("default with null value", () => {
		const ctx = new ContextImpl();
		const keyWithNullDefault = createKey<string | null>({
			displayName: "test",
			default: null,
		});
		const result = ctx.get(keyWithNullDefault);
		expect(result).toBe(null);
	});

	test("undefined default returns null (same as no default)", () => {
		const ctx = new ContextImpl();
		const keyWithUndefinedDefault = createKey<string | undefined>({
			displayName: "test",
			default: undefined,
		});
		// With current keys.ts, undefined default is same as no default - returns null
		const result = ctx.get(keyWithUndefinedDefault);
		expect(result).toBe(null);
	});

	test("defaults work through parent chain", () => {
		const parent = new ContextImpl();
		const child = parent.fork();

		const keyWithDefault = createKey({
			displayName: "test",
			default: "defaultValue",
		});

		// Child should see default even though neither parent nor child has set it
		expect(child.get(keyWithDefault)).toBe("defaultValue");

		// Parent sets a value
		parent.set(keyWithDefault, "parentValue");
		expect(child.get(keyWithDefault)).toBe("parentValue");

		// Child overrides
		child.set(keyWithDefault, "childValue");
		expect(child.get(keyWithDefault)).toBe("childValue");
	});
});

describe("type inference", () => {
	const ctx = new ContextImpl();

	test("String key with default is nullable when got", () => {
		const keyWithDefault = createKey<string>({
			displayName: "test",
			default: "default",
		});
		const result1 = ctx.get(keyWithDefault);
		expectTypeOf(result1).toEqualTypeOf<string | null>();
	});

	test("compile-time type checking for defaults", () => {
		const keyWithoutDefault = createKey<string>({ displayName: "test2" });
		const result2 = ctx.get(keyWithoutDefault);
		expectTypeOf(result2).toEqualTypeOf<string | null>();
	});
});

describe("context level optimization", () => {
	// Type to access internals for verification
	type ContextInternals = {
		parent: Context | null;
	};
	const getParent = (ctx: Context) => {
		return (ctx as any as ContextInternals).parent;
	};

	test("only creates new context levels when functions modify context", async () => {
		const key1 = createKey<string>({ displayName: "key1" });

		const stream = new MarkupStream(null, null, (ctx1) => {
			// Function 1: modifies
			expect(getParent(ctx1)).not.toBeNull(); // has parent (the root)

			ctx1.set(key1, "value1");

			return [
				(ctx2) => {
					// Function 2: only reads
					expect(getParent(ctx2)).toBe(ctx1);

					ctx2.get(key1); // read but don't modify

					return (ctx2a) => {
						// No additional level added - parent is ctx1 to avoid empty
						// parent and overly deep tree
						expect(getParent(ctx2a)).toBe(ctx1);
						return "2a";
					};
				},
				(ctx3) => {
					expect(getParent(ctx3)).toBe(ctx1);

					ctx3.set(key1, "value3");
					return (ctx3a) => {
						// Additional level added - parent is ctx3 because it was modified
						expect(getParent(ctx3a)).toBe(ctx3);
						return "3a";
					};
				},
			];
		});

		const result = await render(stream);
		expect(result).toBe("2a3a"); // Proves both nested functions executed
	});

	test("Context values set before an async await are available to child component. ", async () => {
		const key1 = createKey<string>({ displayName: "async-key1" });

		const stream = new MarkupStream(null, null, [
			async (ctx: Context) => {
				ctx.set(key1, "value-before-await");
				await Promise.resolve();
				return (innerCtx: Context) => {
					const value = innerCtx.get(key1);
					return value || "no-value";
				};
			},
		]);

		const result = await render(stream);
		expect(result).toBe("value-before-await");
	});

	test("Context values set after an async await are available to child component. ", async () => {
		const key1 = createKey<string>({ displayName: "async-key1" });

		const stream = new MarkupStream(null, null, [
			async (ctx: Context) => {
				await Promise.resolve(); // Do async work
				ctx.set(key1, "value-after-await");
				return (innerCtx: Context) => {
					const value = innerCtx.get(key1);
					return value || "no-value";
				};
			},
		]);

		const result = await render(stream);
		expect(result).toBe("value-after-await");
	});

	// Using Once to bypass pre-execution - forces render phase execution
	const NoPreExecute = Once.createComponent();

	test("render phase: async function context after await (bypasses pre-execution)", async () => {
		const key1 = createKey<string>({ displayName: "render-async-key" });

		const stream = (
			<NoPreExecute>
				{async (ctx: Context) => {
					await Promise.resolve(); // Do async work
					ctx.set(key1, "value-after-await-render");
					return (innerCtx: Context) => {
						const value = innerCtx.get(key1);
						return value || "no-value";
					};
				}}
			</NoPreExecute>
		);

		const result = await render(stream);
		expect(result).toBe("value-after-await-render");
	});

	test("render phase: nested async functions with context (bypasses pre-execution)", async () => {
		const key1 = createKey<string>({ displayName: "render-nested-key" });

		const stream = (
			<NoPreExecute>
				{async (ctx1: Context) => {
					await Promise.resolve();
					ctx1.set(key1, "parent-value");

					return async (ctx2: Context) => {
						// Child should see parent's context modification
						const value = ctx2.get(key1);
						expect(value).toBe("parent-value");
						return value || "no-value";
					};
				}}
			</NoPreExecute>
		);

		const result = await render(stream);
		expect(result).toBe("parent-value");
	});

	describe("context level optimization with async functions", () => {
		const key1 = createKey<string>({ displayName: "async-key1" });
		const stream = new MarkupStream(null, null, async (ctx1) => {
			// Function 1: async, modifies after await
			expect(getParent(ctx1)).not.toBeNull(); // has parent (the root)

			await Promise.resolve();
			ctx1.set(key1, "value1");

			return [
				async (ctx2) => {
					// Function 2: async, only reads
					expect(getParent(ctx2)).toBe(ctx1);

					ctx2.get(key1);
					await Promise.resolve();
					ctx2.get(key1);

					return async (ctx2a) => {
						// No additional level added - parent is ctx1 to avoid empty
						// parent and overly deep tree
						expect(getParent(ctx2a)).toBe(ctx1);
						return "2a";
					};
				},
				async (ctx3) => {
					// Function 3: async, modifies before await
					expect(getParent(ctx3)).toBe(ctx1);

					ctx3.set(key1, "value3"); // modify BEFORE await
					await Promise.resolve();

					return async (ctx3a) => {
						// Additional level added - parent is ctx3 because it was modified
						expect(getParent(ctx3a)).toBe(ctx3);
						return "3a";
					};
				},
				async (ctx4) => {
					// Function 4: async, modifies after await
					expect(getParent(ctx4)).toBe(ctx1);

					await Promise.resolve();
					ctx4.set(key1, "value4"); // modify AFTER await

					return async (ctx4a) => {
						// Additional level added - parent is ctx4 because it was modified
						expect(getParent(ctx4a)).toBe(ctx4);
						return "4a";
					};
				},
			];
		});

		test("with pre-execution", async () => {
			const result = await render(stream);
			expect(result).toBe("2a3a4a"); // Proves all three nested functions executed
		});

		test("without pre-execution", async () => {
			const result = await render(<NoPreExecute>{stream}</NoPreExecute>);
			expect(result).toBe("2a3a4a"); // Proves all three nested functions executed
		});
	});
});

describe("in JSX", () => {
	const key = createKey<string>({ displayName: "key" });
	const SetKey: Component<PropsWithChildren<{ value: string }>> = ({ value, children }, ctx) => {
		ctx.set(key, value);
		return <>{children}</>;
	};

	test("context is passed to function children", async () => {
		const rendered = await render(
			<SetKey value="context-value">{(ctx) => `value[${ctx.get(key)}]`}</SetKey>,
		);
		expect(rendered).toBe("value[context-value]");
	});

	test("context is passed to async function children", async () => {
		const rendered = await render(
			<SetKey value="context-value">{async (ctx) => `value[${ctx.get(key)}]`}</SetKey>,
		);
		expect(rendered).toBe("value[context-value]");
	});
});
