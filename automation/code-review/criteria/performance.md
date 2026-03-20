# Performance

Use the findings code PERF.

This framework aims for excellent performance where this can be achieved without compromising usability, extensibility and maintainability.

The review should focus on finding realistic and significant performance problems, not on micro-optimisations.

## Classifying findings

- Classify findings as `Fix` where the fix is conceptually straightforward and can be done safely and mechanically
- Classify findings as `Query` where the fix requires significant rethinking of the approach or has trade-offs that need discussion

## Criteria

You may use your general knowledge of performance analysis. A non-exhaustive list of areas to consider:

### Algorithmic complexity

- Are there operations with unnecessarily poor time or space complexity? For example, repeated linear scans through a large collection where an index or set lookup would be appropriate.
- Are there nested loops over the same or related data sets that could be reduced to fewer passes?

### Unnecessary repeated work

- Is expensive computation (parsing, serialisation, I/O, tree traversal) repeated where the result could be computed once and reused?
- Are objects, closures, or data structures being allocated on every call to a hot path where they could be lifted out?

### Unbounded growth

- Are there caches, buffers, queues, or in-memory collections that can grow without limit? If so, is there a strategy to bound or evict entries?
- Are event listeners, subscriptions, or callbacks registered without a corresponding cleanup path, creating a potential memory leak?

### I/O and resource usage

- Are large files or data sets read entirely into memory where streaming or chunked processing would be practical?
- Are file handles, connections, or other system resources reliably closed or released, including on error paths?
- Are there cases where many small I/O operations could be batched into fewer larger ones?

### Data structure choice

- Are data structures appropriate for the access patterns? For example, using an array where frequent membership testing suggests a Set, or using an object where a Map with non-string keys would be clearer and more efficient.

### String handling

- Are there patterns that build up large strings through repeated concatenation in a loop, where collecting parts and joining would be more appropriate?
