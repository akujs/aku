import { expect, spyOn } from "bun:test";
import type { Container } from "../container/contracts/Container.ts";
import { DispatcherImpl } from "../core/DispatcherImpl.ts";
import type { AnyConstructor } from "../utils.ts";

// Minimal container that throws if used (tests use function listeners, not class listeners)
const noopContainer = {
	get() {
		throw new Error("MockDispatcher does not support class-based listeners");
	},
} as unknown as Container;

export class MockDispatcher extends DispatcherImpl {
	#events: unknown[] = [];

	constructor() {
		super(noopContainer);

		// Spy on all methods to enable assertions on call counts
		spyOn(this, "addListener");
		spyOn(this, "removeListener");
		spyOn(this, "dispatch");
		spyOn(this, "dispatchIfHasListeners");

		// Capture all events by listening on Object (matches all event types via prototype chain)
		this.addListener(Object, (event) => this.#events.push(event));
	}

	expectEvents(expected: object[]): void {
		expect(this.#events).toEqual(expected);
		for (let i = 0; i < expected.length; i++) {
			expect(this.#events[i]).toBeInstanceOf(expected[i].constructor);
		}
	}

	getEvents<T = object>(cls?: AnyConstructor<T>): T[] {
		return this.#events.filter((e) => (cls ? e instanceof cls : true)) as T[];
	}

	clear(): void {
		this.#events.length = 0;
	}
}

export function mockDispatcher(): MockDispatcher {
	return new MockDispatcher();
}
