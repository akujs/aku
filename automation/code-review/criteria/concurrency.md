# Concurrency

Use the findings code ASYNC.


## Classifying findings

- Classify findings as `Fix` where the fix is conceptually straightforward and can be done safely and mechanically
- Classify findings as `Query` where the fix is not straightforward, requires significant architectural changes, or changes across many files that is likely to make this difficult to merge

## Criteria

You may use your knowledge of what a concurrency issue is. A non-exhaustive list of examples:

- incorrect behaviour under certain edge case concurrent scenarios
- nondeterministic behaviour (but only in circumstances where the behaviour _should_ be deterministic)
- unnecessary serialisation of independent async operations
- shared mutable state safety under concurrent access
- AsyncLocalStorage correctness
- race conditions
- missing concurrency limits where the number of parallel operations could be large
- async/sync ambiguity
- using await on a value that can never be a promise