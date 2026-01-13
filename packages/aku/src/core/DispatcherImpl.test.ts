import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { inject } from "../container/inject.ts";
import { BaseListener } from "./BaseListener.ts";
import { DispatcherImpl } from "./DispatcherImpl.ts";

let container: ContainerImpl;
let dispatcher: DispatcherImpl;

beforeEach(() => {
	container = new ContainerImpl();
	dispatcher = new DispatcherImpl(container);
});

describe(DispatcherImpl, () => {
	test("function listeners can be added and invoked", () => {
		class TestEvent {
			constructor(public message: string) {}
		}

		const listener = mock((event: TestEvent) => {
			expect(event.message).toBe("hello");
		});

		dispatcher.addListener(TestEvent, listener);
		dispatcher.dispatch(new TestEvent("hello"));

		expect(listener).toHaveBeenCalledTimes(1);
	});

	test("dispatch calls multiple listeners in order", () => {
		class TestEvent {}

		const callOrder: number[] = [];
		const listener1 = mock(() => {
			callOrder.push(1);
		});
		const listener2 = mock(() => {
			callOrder.push(2);
		});
		const listener3 = mock(() => {
			callOrder.push(3);
		});

		dispatcher.addListener(TestEvent, listener1);
		dispatcher.addListener(TestEvent, listener2);
		dispatcher.addListener(TestEvent, listener3);

		dispatcher.dispatch(new TestEvent());

		expect(listener1).toHaveBeenCalledTimes(1);
		expect(listener2).toHaveBeenCalledTimes(1);
		expect(listener3).toHaveBeenCalledTimes(1);
		expect(callOrder).toEqual([1, 2, 3]);
	});

	test("dispatch does nothing when no listeners registered", () => {
		class TestEvent {}
		dispatcher.dispatch(new TestEvent());
	});

	test("function listeners can be removed", () => {
		class TestEvent {}

		const listener1 = mock(() => {});
		const listener2 = mock(() => {});

		dispatcher.addListener(TestEvent, listener1);
		dispatcher.addListener(TestEvent, listener2);

		dispatcher.removeListener(TestEvent, listener1);
		dispatcher.dispatch(new TestEvent());

		expect(listener1).not.toHaveBeenCalled();
		expect(listener2).toHaveBeenCalledTimes(1);
	});

	test("removeListener handles non-existent event", () => {
		class TestEvent {}

		const listener = mock(() => {});

		// Should not throw
		dispatcher.removeListener(TestEvent, listener);
	});

	test("removeListener handles non-existent listener", () => {
		class TestEvent {}

		const listener1 = mock(() => {});
		const listener2 = mock(() => {});

		dispatcher.addListener(TestEvent, listener1);

		// Should not throw
		dispatcher.removeListener(TestEvent, listener2);

		dispatcher.dispatch(new TestEvent());
		expect(listener1).toHaveBeenCalledTimes(1);
	});

	test("different event types are isolated", () => {
		class EventA {}
		class EventB {}

		const listenerA = mock(() => {});
		const listenerB = mock(() => {});

		dispatcher.addListener(EventA, listenerA);
		dispatcher.addListener(EventB, listenerB);

		dispatcher.dispatch(new EventA());

		expect(listenerA).toHaveBeenCalledTimes(1);
		expect(listenerB).not.toHaveBeenCalled();
	});

	test("same listener added twice is deduplicated", () => {
		class TestEvent {}

		const listener = mock(() => {});

		dispatcher.addListener(TestEvent, listener);
		dispatcher.addListener(TestEvent, listener);

		dispatcher.dispatch(new TestEvent());

		expect(listener).toHaveBeenCalledTimes(1);
	});

	test("class listeners can use dependency injection", () => {
		class TestEvent {
			constructor(public value: number) {}
		}

		class Service {
			multiply(n: number) {
				return n * 2;
			}
		}

		class TestListener extends BaseListener {
			constructor(private service: Service = inject(Service)) {
				super();
			}

			handle(event: TestEvent): void {
				expect(this.service.multiply(event.value)).toBe(42);
			}
		}

		container.bind(Service);

		dispatcher.addListener(TestEvent, TestListener);
		dispatcher.dispatch(new TestEvent(21));
	});

	test("dispatch triggers listeners on parent class", () => {
		class BaseEvent {
			constructor(public data: string) {}
		}
		class ChildEvent extends BaseEvent {
			constructor(
				data: string,
				public extra: number,
			) {
				super(data);
			}
		}

		const objectListener = mock();

		const baseListener = mock((event: BaseEvent) => {
			expect(event.data).toBe("test");
		});

		const childListener = mock((event: ChildEvent) => {
			expect(event.data).toBe("test");
			expect(event.extra).toBe(42);
		});

		dispatcher.addListener(BaseEvent, baseListener);
		dispatcher.addListener(ChildEvent, childListener);
		dispatcher.addListener(Object, objectListener);

		const childEvent = new ChildEvent("test", 42);
		dispatcher.dispatch(childEvent);

		expect(baseListener).toHaveBeenCalledTimes(1);
		expect(childListener).toHaveBeenCalledTimes(1);
		expect(objectListener).toHaveBeenCalledTimes(1);
	});

	test("listeners are called in order from most specific to least specific", () => {
		class BaseEvent {}
		class MiddleEvent extends BaseEvent {}
		class ChildEvent extends MiddleEvent {}

		const callOrder: string[] = [];

		const baseListener = mock(() => {
			callOrder.push("base");
		});

		const middleListener = mock(() => {
			callOrder.push("middle");
		});

		const childListener = mock(() => {
			callOrder.push("child");
		});

		dispatcher.addListener(BaseEvent, baseListener);
		dispatcher.addListener(MiddleEvent, middleListener);
		dispatcher.addListener(ChildEvent, childListener);

		dispatcher.dispatch(new ChildEvent());

		// Listeners should be called from most specific to least specific
		expect(callOrder).toEqual(["child", "middle", "base"]);
	});

	test("removing parent listener doesn't affect child listeners", () => {
		class BaseEvent {}
		class ChildEvent extends BaseEvent {}

		const baseListener = mock(() => {});
		const childListener = mock(() => {});

		dispatcher.addListener(BaseEvent, baseListener);
		dispatcher.addListener(ChildEvent, childListener);

		dispatcher.removeListener(BaseEvent, baseListener);

		const event = new ChildEvent();
		dispatcher.dispatch(event);

		// Only child listener should be called
		expect(baseListener).not.toHaveBeenCalled();
		expect(childListener).toHaveBeenCalledTimes(1);
	});

	test("dispatch triggers both child and parent listeners when both exist", () => {
		class BaseEvent {
			constructor(public value: string) {}
		}
		class ChildEvent extends BaseEvent {
			constructor(
				value: string,
				public extra: number,
			) {
				super(value);
			}
		}

		const baseListener = mock((event: BaseEvent) => {
			expect(event.value).toBe("test");
		});

		const childListener = mock((event: ChildEvent) => {
			expect(event.value).toBe("test");
			expect(event.extra).toBe(42);
		});

		dispatcher.addListener(BaseEvent, baseListener);
		dispatcher.addListener(ChildEvent, childListener);

		const event = new ChildEvent("test", 42);
		dispatcher.dispatch(event);

		// Both listeners should be triggered
		expect(childListener).toHaveBeenCalledTimes(1);
		expect(baseListener).toHaveBeenCalledTimes(1);
	});
});
