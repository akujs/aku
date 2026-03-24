import type { TypeToken } from "../../container/container-key.ts";
import { createTypeToken } from "../../container/container-key.ts";
import type { AnyConstructor, NoArgConstructor } from "../../utils.ts";

type FunctionListener<T extends object> = (event: T) => void;

export interface IClassListenerInstance<T extends object> {
	handle(event: T): void;
}

type ClassListener<T extends object> = NoArgConstructor<IClassListenerInstance<T>> & {
	isClassListener: true;
};

export type EventListener<T extends object> = FunctionListener<T> | ClassListener<T>;

export function isClassListener(value: unknown): value is ClassListener<object> {
	return (
		typeof value === "function" && "isClassListener" in value && value.isClassListener === true
	);
}

/**
 * The EventDispatcher interface defines methods for managing and dispatching events.
 *
 * Events are identified by their class constructor, and the event payload is an instance
 * of that class.
 *
 * @example
 * ```typescript
 * class UserRegistered {
 *   constructor(public userId: string, public email: string) {}
 * }
 *
 * dispatcher.addListener(UserRegistered, (event) => {
 *   console.log(`User ${event.email} registered`);
 * });
 *
 * dispatcher.dispatch(new UserRegistered("123", "user@example.com"));
 * ```
 */
export interface Dispatcher {
	/**
	 * Register a listener for a specific event type.
	 *
	 * The listener will be called whenever an event of the specified type is dispatched.
	 *
	 * You can listen on a superclass to receive events of all subclasses.
	 */
	addListener<T extends object>(event: AnyConstructor<T>, listener: EventListener<T>): void;

	/**
	 * Remove a previously registered listener.
	 */
	removeListener(event: AnyConstructor, listener: Function): void;

	/**
	 * Dispatch an event to all registered listeners.
	 *
	 * Listeners are called in the order they were registered.
	 */
	dispatch<T extends object>(event: T): void;

	/**
	 * Dispatch an event only if listeners are registered, creating the event lazily.
	 *
	 * This is useful when event creation is expensive - the factory function will only
	 * be called if there are listeners registered for the event type.
	 *
	 * The factory function can return a promise - if it does, the value
	 * will be awaited before being dispatched.
	 */
	dispatchIfHasListeners<T extends object>(eventClass: AnyConstructor<T>, factory: () => T): void;

	dispatchIfHasListeners<T extends object>(
		eventClass: AnyConstructor<T>,
		factory: () => Promise<T>,
	): Promise<void>;
}

export const Dispatcher: TypeToken<Dispatcher> = createTypeToken("Dispatcher");
