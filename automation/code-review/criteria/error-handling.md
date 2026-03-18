# Error Handling

Use the findings code ERROR.

Review the specified code for error handling correctness. The guiding philosophy is: **handle what you can, surface what you can't**. Framework code should recover from errors it understands and can act on, and surface everything else to the consuming application in a way that gives the consumer enough information and control to handle it appropriately.

Be selective. Prioritise findings that affect correctness, could swallow errors silently, or would leave a consumer unable to diagnose or recover from a failure.

## Classifying findings

- Classify findings as `Fix` where the fix is conceptually straightforward and can be done safely and mechanically
- Classify findings as `Query` where the fix requires significant changes to error propagation paths, changes the contract of a public API, or could affect how consumers handle errors

## General principles

### Internal vs consumer errors

The framework has two audiences for error handling:

- **Internal handling**: errors the framework can meaningfully act on (e.g. retrying a database transaction on a concurrency error, returning a default value when a storage file is not found). These should be handled silently or surfaced through the event system for monitoring, not thrown to the consumer.
- **Consumer-facing errors**: errors that the framework cannot resolve and that the consuming application must handle (e.g. invalid configuration, failed I/O that the consumer initiated, validation errors on user input). These must be surfaced with enough context for the consumer to diagnose and act.

A key question for each error path: **who is in the best position to decide what to do?** If the framework knows the right action, take it. If not, surface the error.

### Error hierarchy and domain specificity

- Custom error classes should extend from `AkuError` and represent a specific domain failure, not a generic one. The error class name should tell the consumer what category of thing went wrong (e.g. `StorageNotFoundError`, `DatabaseQueryError`), not just that something failed.
- Use the standard `Error.cause` property to chain underlying errors. This preserves the original stack while allowing the framework to add domain context.
- Avoid creating error classes for situations where a plain `AkuError` with a descriptive message would suffice. New subclasses are justified when consumers need to `catch` and branch on the error type, or when the error carries structured data beyond a message.

### Error context and diagnosability

- Error messages should contain enough information to diagnose the problem without requiring a debugger. Include the operation being attempted, the relevant identifiers (file path, table name, query), and what went wrong.
- Avoid generic messages like "An error occurred" or "Operation failed". If the framework doesn't know what happened, say so explicitly (e.g. "Unknown error during storage read of {path}").
- Where errors are enriched or wrapped, always preserve the original error as `cause` so that the full chain is available in logs.

## Criteria

### Swallowed errors

- Are there `catch` blocks that discard the error without logging, re-throwing, or dispatching an event? Empty catch blocks and catch blocks that only log at debug level are almost always wrong.
- Are there error paths where a meaningful failure is silently converted to a default value (e.g. returning `null` or `undefined` instead of surfacing the error)?
- When doing cleanup or tear-down while handling an error, if a second error occurs as a result of the tear-down, do not throw the second error as this will mask the first. Swallow the second error and document that this is to avoid masking the first.

### Error type correctness

- Are errors thrown with the appropriate custom error class? Never throw `Error` or `AkuError` directly.
- Are `instanceof` checks against the correct error type? A check against a base class where a specific subclass is intended could match errors that should not be caught.
- Is there code that checks error properties (e.g. `error.code`, `error.message`) with string matching where an `instanceof` check against a well-defined error class would be more robust?

### Errors from dependencies

Our policy as a framework is to completely wrap the API of any dependency and this includes errors. Every time we call a dependency method that might throw an error, we must wrap it in a try catch and convert the error to an appropriate framework error.


### Control flow exceptions

- The `AbortException` pattern is used for HTTP response control flow and is intentionally not an error. Code that catches exceptions in the HTTP pipeline must distinguish between `AbortException` (control flow, expected) and other exceptions (genuine errors, unexpected).
- Are there cases where `AbortException` could be accidentally caught by a broad `catch` block and treated as an error?
- Are there cases where a genuine error could be mistakenly treated as control flow?

### Error response fidelity

- When the framework converts an internal error to an HTTP response, does the response status code accurately reflect the nature of the failure? (e.g. a validation error should be 422, not 500; a missing resource should be 404, not 400).
- In production mode, are internal error details (stack traces, query text, file paths) excluded from responses sent to clients?
- In development mode, are sufficient error details included to aid debugging?

### Transient error recovery

- For operations that interact with external systems (database, storage, network), is there appropriate retry logic for known-transient failures?
- Are retry strategies bounded (max attempts, max delay) to prevent infinite loops?
- Is there a clear distinction between transient errors (worth retrying) and permanent errors (should fail immediately)?
- After exhausting retries, is the original or most relevant error surfaced rather than a generic "max retries exceeded" error?

### Resource cleanup on error

- When an error occurs during an operation that has acquired resources (database connections, file handles, streams, transactions), are those resources properly released in the error path?
- Are `finally` blocks used where cleanup must happen regardless of success or failure?
- In transaction handling, is rollback reliably triggered on error?

### Error events and observability

- For errors that the framework handles internally (retries, fallbacks, recoverable failures), is an event dispatched so that the consuming application can monitor and log these occurrences?
- Do error events include sufficient context (operation type, timing, identifiers) to be useful for monitoring?
- Are errors that indicate potential misconfiguration or developer mistakes surfaced clearly (e.g. console warnings, descriptive error messages) rather than failing silently?

### Validation and precondition errors

- Are invalid inputs detected early, before side effects occur? A validation error should be raised before a database write or file mutation, not after.
- Are precondition checks (e.g. "this method must not be called after dispose") enforced with clear error messages that tell the developer what they did wrong and what they should do instead?
- Is there a consistent pattern for surfacing validation errors to HTTP clients (the `abort.unprocessableEntity()` pattern)?
