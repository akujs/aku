# Persistent Object Store

> ⚠ TBD: Design a facility for storing and retrieving JSON objects, built on top of ObjectStore (§2.1 of pipeline.md). Must support:
>
> - Concurrency-safe writes using compare-and-swap or similar primitives
> - Retry on transient failures
> - Caching on read to avoid hitting ObjectStore on every access
>
> This is a general-purpose building block, not specific to the pipeline. Used by pipeline salt rotation (§5.5) and potentially other components.

Implement a SWR style API, one threshold that triggers a background refresh, a wider threshold below which it's OK to return the stale value while a refresh is in progress.