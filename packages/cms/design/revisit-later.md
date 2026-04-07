**§5.1 Client Event Capture — event persistence**
Currently events are held only in memory and lost on tab close. Two persistence options were deferred:
1. Write events to storage immediately on capture, delete on server ack — most robust, survives crashes and tab close. Raises GDPR concerns (event data written to device storage before consent confirmed) and requires cross-tab synchronisation (Web Locks, or per-tab session ownership with stale session adoption on load).
2. Persist in-flight events only on `visibilitychange`/page unload — reduces GDPR exposure, avoids cross-tab complexity, but `sendBeacon` gives no ack so persistence is still needed to enable retry.

---

Queues have a Dead Letter Queue (DLQ) that is used to capture messages that cannot be processed.

The design of the pipeline is to handle all unrecoverable errors internally, e.g. drop malformed messages. The DLQ may catch bugs, or infrastructure misconfiguration eg queue consumer doesn't have permission to write to storage.

Consider exposing DLQ in advanced UI for debugging.


---

Benchmark time taken at each step on real infrastructure, stress test