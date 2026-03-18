# Events

Use the findings code EVENT.

The event system exists to provide observability hooks and to support event-driven features. Events are dispatched through a central `Dispatcher` and identified by class constructor. Listeners registered on a superclass receive events of all subclasses, enabling both fine-grained and broad observation.

This review stage checks that events are well designed and correctly used. It does not cover naming conventions, base class requirements, or file placement — these are enforced by lint rules.

## Philosophy

Events in Aku serve two purposes:

1. **Observability**: allowing application code and tooling to observe what the framework is doing (e.g. tracing database queries, logging storage operations, measuring request handling). These events should be read-only and should not influence the operation that dispatched them.
2. **Extension points**: allowing application code to react to framework activity and, in limited cases, influence it (e.g. `TransactionPreCommitEvent` can abort a transaction). These must be clearly documented as having side-effect potential.

A good event tells a consumer *what happened* (or *what is about to happen*) with enough context to act on it, without exposing internal implementation details that would create coupling between the listener and the dispatching code.

## Classifying findings

- `Fix`: the change is clearly clearly required — e.g. there is a bug in causing an event not to be dispatched at the right time, or to be dispatched with incorrect data, or correcting clear documentation error
- `Query`: the change affects the shape or semantics of an event class, or requires a judgement call about whether to proceed. All API changes are `Query` by default.

## Criteria

### Coverage: are the right operations observable?

Note this section is high level and abstract, so use extended thinking / ultrathink to determine if teh code meets the requirements.

- Every I/O operation and significant state transition that a consumer might reasonably want to observe should dispatch events. If a module performs I/O (HTTP requests, database queries, file operations, cache access) without dispatching events, that is a gap. If a significant state transition that applications may be interested in happens within a flow without dispatching an event, that is a gap. Even without I/O, operations that take significant resources may warrant dispatching events so that applications can measure resource consumption.
- Conversely, purely internal computation that has no externally meaningful side effects does not need events. Not every method call warrants an event.
- Consider the consumer's perspective: if someone is building a request-tracing dashboard, an APM integration, or an audit log, can they get the data they need from the events available?

### The three-phase pattern for I/O operations

Operations that perform I/O or other operations that can fail should follow the established three-phase event pattern:

- **Starting event** (present participle, e.g. `FileWritingEvent`): dispatched before the operation begins. Carries the operation's inputs and a `startTimestamp`. Extends the module's `OperationStartingEvent` base class.
- **Completed event** (past participle, e.g. `FileWrittenEvent`): dispatched after the operation succeeds. Carries the result and `timeTakenMs`. Extends the module's `OperationCompletedEvent` base class. Receives the starting event in its constructor to derive timing and delegate input properties.
- **Failed event** (e.g. `StorageOperationFailedEvent`, `QueryFailedEvent`): dispatched when the operation fails. Carries the error and `timeTakenMs`.

Review for:

- Are all three phases present? A starting event without a completed/failed counterpart, or vice versa, is incomplete.
- Is timing calculated consistently? Completed and failed events should derive `timeTakenMs` from the starting event's `startTimestamp`.
- Does the completed event provide access to the operation's inputs without duplicating them? The preferred pattern is to hold a private reference to the starting event and expose its properties via getters.

### Event class hierarchy

Each module should define an abstract base event class (e.g. `StorageEvent`, `DatabaseEvent`) that carries context common to all events in that module. This enables consumers to listen on the base class to receive all events for a module.

Review for:

- Does the module base event carry the right shared context? For example, `DatabaseEvent` carries transaction context; `StorageEvent` carries disk and path.
- Is the hierarchy deep enough to be useful but shallow enough to be understandable? Three levels is typical: `AkuEvent` → module base → concrete event. Avoid deeper hierarchies unless there is a clear grouping benefit (the storage module's `OperationStartingEvent` / `OperationCompletedEvent` intermediate classes are justified because they share the phase-specific timing logic).

### Event data: what to include

- Events should carry enough data for consumers to act without needing to look things up elsewhere. For example, `QueryExecutedEvent` carries both the statement and the result.
- Events should not carry mutable references to internal state that a listener could use to corrupt the dispatching code. Prefer readonly properties. Where a value like a `Response` body can only be consumed once, provide a clone method (as `RequestHandledEvent.cloneResponse()` does).
- Avoid including data that is expensive to compute unless it is gated behind `dispatchIfHasListeners` with a lazy factory, or computed on demand via a getter.

### Dispatch mechanism

- Use `dispatch()` for events that are cheap to construct.
- Use `dispatchIfHasListeners()` with a factory function for events that are expensive to construct, or where construction involves cloning or other allocation that should be avoided when nobody is listening. For example, `RequestHandledEvent` is dispatched this way because it wraps a `Response`.
- Events should be dispatched at the right granularity. Dispatching inside a tight loop is a red flag — consider whether a single summary event after the loop would be more appropriate.

### Side effects from listeners

- By default, events are informational: listeners observe but do not influence the operation.
- Where a listener *can* influence the outcome (e.g. `TransactionPreCommitEvent` where throwing aborts the transaction), this must be explicitly documented on the event class.
- Review whether any dispatch sites inadvertently allow listener exceptions to disrupt normal control flow. If an event is purely observational, consider whether listener errors are caught appropriately.

### Documentation

- Each concrete event class should have a doc comment that states when it is dispatched, in plain language.
- Events that support listener-driven side effects must document this prominently.
- The `phase` property (`"start"`, `"complete"`, `"fail"`) and `type` discriminant should be present and consistent with the naming conventions in the module.

### Consistency across modules

- Do different modules follow the same structural patterns? If the storage module dispatches three-phase events for all I/O operations, the database module should follow the same pattern for its operations, and any new module that performs I/O should do likewise.
- Are the abstract base classes structured consistently? (e.g. `OperationStartingEvent` always has `startTimestamp`; `OperationCompletedEvent` always has `timeTakenMs` derived from the starting event.)
- Is the `type` discriminant string formatted consistently across modules? (e.g. `"file:write"`, `"query:execute"` — colon-separated `noun:verb` format.)
