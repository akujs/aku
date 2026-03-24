import { expect } from "bun:test";

type Voidify<T> = T extends Promise<unknown> ? Promise<void> : void;

export function expectError<T extends Error, R>(
	fn: () => R,
	errorClass: new (...args: never[]) => T,
	assertError: (error: T) => void,
): Voidify<R> {
	const checkThrownValue = (err: unknown) => {
		expect(err).toBeInstanceOf(errorClass);
		assertError(err as T);
	};
	const shouldHaveThrown = () => {
		throw new Error(`Expected function to throw ${errorClass.name}`);
	};
	let thrown: unknown;
	let result: unknown;
	try {
		result = fn();
	} catch (err) {
		thrown = err;
	}
	if (result instanceof Promise) {
		return result.then(shouldHaveThrown, checkThrownValue) as Voidify<R>;
	}
	if (!thrown) {
		shouldHaveThrown();
	}
	checkThrownValue(thrown);
	return undefined as Voidify<R>;
}
