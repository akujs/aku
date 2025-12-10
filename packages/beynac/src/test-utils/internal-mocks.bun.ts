import { expect, mock } from "bun:test";
import type { Dispatcher } from "../core/contracts/Dispatcher.ts";

export interface MockDispatcher extends Dispatcher {
	expectEvents: (expected: object[]) => void;
	getEvents: () => object[];
	clear: () => void;
}

export function mockDispatcher(): MockDispatcher {
	const events: unknown[] = [];
	const dispatch = mock((event: object) => {
		events.push(event);
	});

	return {
		addListener: mock(() => {}),
		removeListener: mock(() => {}),
		dispatch: dispatch as Dispatcher["dispatch"],
		dispatchIfHasListeners: mock(async function dispatchIfHasListeners<T extends object>(
			_: unknown,
			factory: () => T | Promise<T>,
		): Promise<void> {
			events.push(await factory());
		}) as Dispatcher["dispatchIfHasListeners"],
		expectEvents(expected: object[]) {
			const events = dispatch.mock.calls.map((call) => call[0]);
			expect(events).toEqual(expected);

			for (let i = 0; i < expected.length; i++) {
				expect(events[i]).toBeInstanceOf(expected[i].constructor);
			}
		},
		getEvents() {
			return events as object[];
		},
		clear() {
			events.length = 0;
			dispatch.mockClear();
		},
	};
}
