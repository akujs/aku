import { expect, mock } from "bun:test";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";

export interface MockDispatcher extends Dispatcher {
	expectEvents: (expected: object[]) => void;
	clear: () => void;
}

export function mockDispatcher(): MockDispatcher {
	const dispatch = mock((_event: object) => {});

	return {
		addListener: mock(() => {}),
		removeListener: mock(() => {}),
		dispatch: dispatch as Dispatcher["dispatch"],
		dispatchIfHasListeners: mock(function dispatchIfHasListeners<T extends object>(
			_: unknown,
			factory: () => T | Promise<T>,
		): void | Promise<void> {
			const result = factory();
			if (result instanceof Promise) {
				return result.then((event) => {
					dispatch(event);
				});
			} else {
				dispatch(result);
			}
		}) as Dispatcher["dispatchIfHasListeners"],
		expectEvents(expected: object[]) {
			const events = dispatch.mock.calls.map((call) => call[0]);
			expect(events).toEqual(expected);

			for (let i = 0; i < expected.length; i++) {
				expect(events[i]).toBeInstanceOf(expected[i].constructor);
			}
		},
		clear() {
			dispatch.mockClear();
		},
	};
}
