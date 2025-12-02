import { afterEach, describe, expect, test } from "bun:test";
import { sleep } from "../utils.ts";
import { mock, mockable, onResetAllMocks, resetAllMocks, resetMock } from "./mocks.ts";

describe(mockable, () => {
	test("creates a mockable function", () => {
		const fn = mockable((x: number) => x * 2);
		expect(fn(5)).toBe(10);
	});

	test("preserves function name", () => {
		function myTestFunction(x: number): number {
			return x * 2;
		}
		const wrapped = mockable(myTestFunction);
		expect(wrapped).not.toBe(myTestFunction);
		expect(wrapped.name).toBe("myTestFunction");
	});

	test("degrades gracefully when Function constructor is not available", () => {
		const originalFunction = globalThis.Function;
		globalThis.Function = function (..._args: unknown[]): never {
			throw new Error("Function constructor is not available");
		} as unknown as FunctionConstructor;

		function myTestFunction(x: number): number {
			return x * 2;
		}

		const wrapped = mockable(myTestFunction);

		// Function still works
		expect(wrapped(5)).toBe(10);

		// Name is not preserved when Function constructor fails
		expect(wrapped.name).not.toBe("myTestFunction");

		globalThis.Function = originalFunction;
	});
});

describe(mock, () => {
	const originalFn = mockable((x: number) => x * 2);

	afterEach(() => {
		resetMock(originalFn);
	});

	test("replaces implementation", () => {
		mock(originalFn, (x: number) => x * 3);
		expect(originalFn(5)).toBe(15);
	});

	test("throws when mocking non-mockable function", () => {
		const regularFn = (x: number) => x * 2;
		expect(() => mock(regularFn, (x: number) => x * 3)).toThrow(
			"Cannot mock function: not created with mockable()",
		);
	});

	test("allows multiple mocks in sequence", () => {
		mock(originalFn, (x: number) => x * 3);
		expect(originalFn(5)).toBe(15);

		mock(originalFn, (x: number) => x + 10);
		expect(originalFn(5)).toBe(15);
	});
});

describe(resetMock, () => {
	test("restores original implementation", () => {
		const fn = mockable((x: number) => x * 2);

		mock(fn, (x: number) => x * 3);
		expect(fn(5)).toBe(15);

		resetMock(fn);
		expect(fn(5)).toBe(10);
	});

	test("throws when resetting non-mockable function", () => {
		const regularFn = (x: number) => x * 2;
		expect(() => resetMock(regularFn)).toThrow("not created with mockable()");
	});

	test("includes function name in error message when available", () => {
		function namedFunction(): void {}
		expect(() => resetMock(namedFunction)).toThrow("namedFunction");
	});
});

describe(resetAllMocks, () => {
	test("resets all mocked functions", () => {
		const fn1 = mockable((x: number) => x * 2);
		const fn2 = mockable((x: number) => x * 3);

		mock(fn1, (x: number) => x * 10);
		mock(fn2, (x: number) => x * 20);

		expect(fn1(5)).toBe(50);
		expect(fn2(5)).toBe(100);

		resetAllMocks();

		expect(fn1(5)).toBe(10);
		expect(fn2(5)).toBe(15);
	});

	test("calls registered callbacks", () => {
		let callbackCalled = false;
		onResetAllMocks(() => {
			callbackCalled = true;
		});

		resetAllMocks();

		expect(callbackCalled).toBe(true);
	});

	test("clears callback list after reset", () => {
		let callCount = 0;
		onResetAllMocks(() => {
			callCount++;
		});

		resetAllMocks();
		expect(callCount).toBe(1);

		// Second reset should not call the callback again
		resetAllMocks();
		expect(callCount).toBe(1);
	});

	test("handles multiple callbacks", () => {
		const calls: string[] = [];

		onResetAllMocks(() => calls.push("first"));
		onResetAllMocks(() => calls.push("second"));
		onResetAllMocks(() => calls.push("third"));

		resetAllMocks();

		expect(calls).toEqual(["first", "second", "third"]);
	});

	test("does not prevent garbage collection of callbacks", async () => {
		// This test verifies that callbacks can be garbage collected
		let collected = false;
		const registry = new FinalizationRegistry(() => {
			collected = true;
		});

		createAndRegisterCallback(registry);

		// Force garbage collection and wait for finalization
		Bun.gc(true);
		const startTime = Date.now();
		while (!collected) {
			if (Date.now() - startTime > 1000) {
				throw new Error(`Callback was not garbage collected after 1 second`);
			}
			if (collected) {
				break;
			}
			await sleep(1);
		}

		// If we reach here, the callback was successfully GC'd
		expect(collected).toBeTrue();
	});
});

// Helper function to create and register callback in a separate scope
function createAndRegisterCallback(registry: FinalizationRegistry<unknown>): void {
	const callback = () => {};
	registry.register(callback, undefined);
	onResetAllMocks(callback);
}

describe("integration", () => {
	afterEach(() => {
		resetAllMocks();
	});

	test("mock and reset workflow", () => {
		const add = mockable((a: number, b: number) => a + b);
		const multiply = mockable((a: number, b: number) => a * b);

		// Original behavior
		expect(add(2, 3)).toBe(5);
		expect(multiply(2, 3)).toBe(6);

		// Mock behavior
		mock(add, (a: number, b: number) => a + b + 100);
		mock(multiply, (a: number, b: number) => a * b * 10);

		expect(add(2, 3)).toBe(105);
		expect(multiply(2, 3)).toBe(60);

		// Reset one
		resetMock(add);
		expect(add(2, 3)).toBe(5);
		expect(multiply(2, 3)).toBe(60); // Still mocked

		// Reset all
		resetAllMocks();
		expect(add(2, 3)).toBe(5);
		expect(multiply(2, 3)).toBe(6);
	});

	test("works with functions that have default parameters", () => {
		const greet = mockable((name = "World") => `Hello, ${name}!`);

		expect(greet()).toBe("Hello, World!");
		expect(greet("Alice")).toBe("Hello, Alice!");

		mock(greet, (name = "World") => `Hi, ${name}!`);

		expect(greet()).toBe("Hi, World!");
		expect(greet("Bob")).toBe("Hi, Bob!");
	});

	test("preserves function context when needed", () => {
		const obj = {
			value: 42,
			getValue: mockable(function (this: { value: number }) {
				return this.value;
			}),
		};

		expect(obj.getValue()).toBe(42);

		mock(obj.getValue, function (this: { value: number }) {
			return this.value * 2;
		});

		expect(obj.getValue()).toBe(84);
	});
});
