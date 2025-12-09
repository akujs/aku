import type { Dispatcher } from "../core/contracts/Dispatcher.ts";
import type {
	DatabaseOperationCompletedEvent,
	DatabaseOperationStartingEvent,
	DatabaseOperationType,
} from "./database-events.ts";

// Wraps a database operation with event dispatch for observability.
// Dispatches a "starting" event before the operation and a "completed" event
// after success, or a "failed" event if it throws.
export function databaseOperation<TResult, TStartEvent extends DatabaseOperationStartingEvent>(
	operationType: DatabaseOperationType,
	fn: () => Promise<TResult>,
	beforeEvent: () => TStartEvent,
	afterEvent: (startEvent: TStartEvent, result: TResult) => DatabaseOperationCompletedEvent,
	failedEvent: (startEvent: TStartEvent, error: unknown) => void,
	dispatcher: Dispatcher,
): Promise<TResult> {
	const startEvent = beforeEvent();

	if (startEvent.type !== operationType) {
		throw new Error(
			`Event type mismatch: expected "${operationType}" but event has type "${startEvent.type}"`,
		);
	}

	dispatcher.dispatch(startEvent);

	return fn().then(
		(result) => {
			dispatcher.dispatch(afterEvent(startEvent, result));
			return result;
		},
		(error) => {
			failedEvent(startEvent, error);
			throw error;
		},
	);
}
