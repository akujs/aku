# Concurrency

Use the findings code ASYNC.

Review the specified code for concurrency and async correctness. Covers unnecessary serialisation of independent async operations, shared mutable state safety under concurrent access, AsyncLocalStorage correctness, race conditions, missing concurrency limits where the number of parallel operations could be large, and async/sync ambiguity.

## Classifying findings

- Classify findings as `Fix` where the fix is conceptually straightforward and can be done safely and mechanically
- Classify findings as `Query` where the fix is not straightforward, requires significant architectural changes, or changes across many files that is likely to make this difficult to merge