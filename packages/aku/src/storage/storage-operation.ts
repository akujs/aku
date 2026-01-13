import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import { NotFoundError, StorageError, StorageUnknownError } from "./storage-errors.ts";
import type { StorageOperationCompletedEvent } from "./storage-events.ts";
import {
	StorageOperationFailedEvent,
	type StorageOperationStartingEvent,
	type StorageOperationType,
} from "./storage-events.ts";

type EventValueForFn<TFn> = TFn extends () => AsyncGenerator<unknown, unknown, unknown>
	? number
	: TFn extends () => Promise<infer TResult>
		? TResult
		: never;

export function storageOperation<
	TFn extends (() => Promise<unknown>) | (() => AsyncGenerator<unknown, unknown, unknown>),
	TStartEvent extends StorageOperationStartingEvent,
>(
	operationType: StorageOperationType,
	fn: TFn,
	beforeEvent: () => TStartEvent,
	afterEvent: (
		startEvent: TStartEvent,
		result: EventValueForFn<TFn>,
	) => StorageOperationCompletedEvent,
	dispatcher: Dispatcher,
	options: { onNotFound: "throw" | Awaited<ReturnType<TFn>> },
): ReturnType<TFn> {
	const startEvent = beforeEvent();

	if (startEvent.type !== operationType) {
		throw new Error(
			`Event type mismatch: expected "${operationType}" but event has type "${startEvent.type}"`,
		);
	}

	const handleStorageError = (error: unknown): ReturnType<TFn> | void => {
		if (options.onNotFound !== "throw" && error instanceof NotFoundError) {
			return options.onNotFound;
		}

		let storageError =
			error instanceof StorageError ? error : new StorageUnknownError(operationType, error);

		dispatcher.dispatch(new StorageOperationFailedEvent(startEvent, storageError));
		throw storageError;
	};

	dispatcher.dispatch(startEvent);

	const result = fn();

	if (Symbol.asyncIterator in result) {
		return (async function* () {
			let count = 0;
			try {
				for await (const value of result) {
					count++;
					yield value;
				}
				dispatcher.dispatch(afterEvent(startEvent, count as EventValueForFn<TFn>));
			} catch (error) {
				handleStorageError(error);
			}
		})() as ReturnType<TFn>;
	}

	return result
		.then((value) => {
			dispatcher.dispatch(afterEvent(startEvent, value as EventValueForFn<TFn>));
			return value;
		})
		.catch(handleStorageError) as ReturnType<TFn>;
}
