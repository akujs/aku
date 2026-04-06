# Aku Analytics Pipeline — Design Specification

## Note for contributing LLMs

This is a design specification under active development. Your role is to propose, challenge assumptions, and improve phrasing — not to make technical decisions. All decisions require explicit approval from the human. Don't add content unless explicitly asked to. Don't interpret questions as instructions to edit. Propose content in chat, wait for explicit go-ahead before writing to this file. Write terse, information-dense prose — cut anything a competent engineer/LLM can infer from context.

Keep the document consistent. Section numbers are used to refer to other sections in the document, and there are summaries like the configuration section that reflect what is discussed later in the document. When changing a section, update the appropriate summary. If you notice an inconsistency, flag it along with a proposed fix. 

The goal of this design process is to create a system that has exceptionally high levels of engineering rigour. This is the opposite of Vibe Coding - we're building a distributed system with finely specified behaviour and comprehensive tests that will never fail outside of well defined failure modes. Act accordingly. Question everything. Look for ways that any proposed solution can fail.

- ⚠ TBD markers are intentional gaps awaiting a decision. Do not fill them with assumptions. If you become aware of a gap that needs filling, add a `⚠ TBD` marker or flag it to the human.
- This document is intended to be a comprehensive map of data flows and error handling. If you see any gap where it's not clear where data comes from, goes to, how it is transformed, what errors can happen and how they are handled, or if these exist but you think they may be incomplete, proactively suggest adding a `⚠ TBD` marker.
- If any text appears to rest on an unstated assumption — including text written by the human — flag it.
- All configurable properties must be defined in §3.5. If a pipeline step introduces a value that could reasonably vary between deployments or be tuned, add it to §3.5 rather than hardcoding it in the step description.

## 1. Preamble

### 1.1 Infrastructure Abstraction

This system is designed to run on any infrastructure stack. Every external dependency — object storage, queues, HTTP handling, scheduled execution, and others — is accessed exclusively through interfaces.

### 1.2 Deterministic Simulation Testing

The system is designed to be fully exercisable under a deterministic simulation. Every source of non-determinism — time, I/O, injected failures — is accessed through an interface called a "DST Mock Point". See §7 for DST Mock Point design principles.

### 1.3 Resilience to Duplicate and Concurrent Execution

Infrastructure primitives such as queues and cron schedulers provide at-least-once delivery guarantees. The system therefore assumes that any step may execute multiple times — sequentially or concurrently — and must not corrupt state as a result. Each step must be designed to be safe under concurrent execution.

If a pipeline step can be made idempotent, so much the better. But as a catch-all, events are deduplicated at the final step, so some duplication is permissible.

DST scenarios must explicitly exercise duplicate and concurrent execution of every step.

---

## 2. Infrastructure Primitives

### 2.1 Object Storage (`ObjectStore`)

Provides durable, addressable blob storage.

> ⚠ TBD: define interface based on requirements of pipeline stages, don't use interfaces from supporting libraries directly

**DST failure modes to support:**
- failure of any operation, write, read, list, delete
- failures may be transient (retry immediately succeeds) or persistent (long enough for retry to time out)
- partial failure of a batch if asked to add/delete many
- slow response for any operation
- in the case of paginated operations (list) success for initial page followed by failure or delay
- inconsistency of read and list operations - after an object is created, reads and lists may show it to be missing for some amount of time

### 2.2 Queue (`Queue`)

Provides durable, at-least-once message delivery between pipeline stages.

**Consumer API model:** the queue provides a handler function to the consumer. Returning / resolving without error constitutes acknowledgement. Throwing or rejecting the promise constitutes failure, and the message will be redelivered.

> ⚠ Interface definition TBD

**DST failure modes to support:** enqueue failure, delivery failure, duplicate delivery, out-of-order delivery.

### 2.3 HTTP Request Handler (`HttpHandler`)

Provides the ability to receive and respond to inbound HTTP requests (ingestion endpoint).

> ⚠ Interface definition TBD

**DST failure modes to support:** request timeout, connection failure, malformed request body.

### 2.4 Scheduled Task (`CronScheduler`)

Provides scheduled/periodic task execution with at-least-once trigger semantics.

> ⚠ Interface definition TBD

**DST failure modes to support:** missed trigger, duplicate trigger, delayed trigger.

### 2.5 Logging

Provides the ability to log a message for debugging.

> ⚠ Interface definition TBD

**DST failure modes to support:** none: logging is different, the API can never throw.

Note: our logging impl must be a wrapper that swallows any exceptions from the host-provided impl

---

## 3. Data Flow

### 3.1 Data Flow Overview

1. Event created
   a. in client browser, automatically generated from page transitions or pushed by application code
   b. server-side through API
2. Enriched on the server, PII like IP address stripped
3. Aggregated into daily batches, first round of deduplication applied
4. Synced to the analysis app, stored in DuckDB, second round of deduplication applied, sessions inferred

### 3.2 Deduplication

Events have a 64bit random integer ID, generated client-side, and used for deduplication. Given the birthday paradox there's a chance of collisions - ~1% of a single collision in 500- million events - but will be trivial compared to the amount of loss due to client failures.

### 3.3 Event Timing

Server time is assumed to be reasonably consistent across servers. At ingestion, events are assigned a `ingest_time` which is used for batching, grouping, and catch-up queries. When the analysis app asks "give me all events since time X", it's asking for events by ingest time.

The server is expected to tolerate a small amount of clock drift between servers, so when handling a batch of events ingested from times `X` to `Y`, it must tolerate for example an event with ingest_time Y - 5s arriving after the `X-Y` batch is processed.

The time that matters for analysis is `create_time` — the time at which the event was created by the client. Here we correct for unreliable client clocks by asking the client for a creation time and transmission time, and using the delta to compute a time offset to apply to the server clock.

The analysis app must handle much larger drifts in  `create_time`, events can be submitted up to 48h late, and a late arriving event might change the results of a query.

### 3.4 Maximum Event Size & Volume

To prevent denial of wallet attacks and keep the analysis app working smoothly, we apply some limits on event size and volume.

- Properties not in the schema defined below are dropped silently (this includes free-form `properties` bag)
- Max 25 KV pairs in the properties bag, excess dropped with logged warning by client
- Properties with keys longer than 40 chars or values longer than 100 chars are dropped with logged warning by client
- Max 10 events per second per client, excess dropped with logged warning by client, designed to handle accidental client misbehaviour, not malicious attacks

### 3.5 Configuration

All configuration is server-side. The client is initialised with only `endpoint` and `project`. Every server response includes the current configuration, so clients pick up changes immediately.

**Server configuration:**

```json5
{
    // Events older than this (by transmit_time - create_time) are dropped
    max_event_delay_hours: 48,
    // Max KV pairs in properties bag; excess dropped
    max_property_count: 25,
    // Max property key length in chars; oversized dropped
    max_property_key_length: 40,
    // Max property value length in chars; oversized dropped
    max_property_value_length: 100,
    // Token refresh rate for client-side rate limiter
    client_max_events_per_second: 10,
    // Token bucket window — allows up to rate × window events in a sliding window
    client_max_events_window_seconds: 10,
}
```

**Client-only configuration (set at init, not from server):**

```json5
{
    // URL of the server event capture endpoint (§5.2)
    endpoint: "https://analytics.example.com/ingest",
    // Project identifier, included on every event
    project: "akujs.dev",
}
```

---

## 4. Pipeline Architecture Overview

### 4.1 Reliability and Error Handling

**Overall approach:** the system is resilient by depth. Each step handles its own errors locally where possible, retrying as necessary. Duplication is avoided where practical, but permissible and unavoidable.

Each step should document the conditions under which it will drop and log events instead of crashing. For example, events may be too large, or contain invalid data.

---

## 5. Pipeline Steps

### 5.1 Client Event Capture

**Purpose:** Receives events from [capture api](./client-capture-api.md), buffers in memory, transmits to server with retry.

**Inputs:** Events from application code (instrumented site/app)

Events will be grouped together and sent in batches to the server.

**Outputs:** HTTP POST containing one or more events to Server Event Capture (§5.2)

Format for events:

```json5
{
    type: "events-create",
    // ISO 8601 UTC, updated on each retry to current time
    transmit_time: "2026-04-05T14:23:02.100Z",
    events: [
        {
            // (string, required) — 64-bit random integer as string
            id: "8371625098432175904",
            // Event name
            name: "pageview",
            // Optional project identifier
            project: "akujs.dev",
            // ISO 8601 UTC
            create_time: "2026-04-05T14:23:01.456Z",
            // optional, ties sessions to business-level user identity
            user_id: "user-abc-123",
            // optional, groups requests together into sessions, use if the client
            // has access to authoritative session info otherwise server will infer
            session_id: "user-abc-123",
            // optional, current page URL
            page_url: "https://example.com/pricing",
            // optional, HTTP referrer
            page_referrer: "https://google.com",
            // optional, document.title
            page_title: "Pricing — Example",
            // optional, viewport width in CSS pixels
            viewport_width: 1280,
            // optional, viewport height in CSS pixels
            viewport_height: 720,
            // optional, true if primary input is touch (matchMedia('(pointer: coarse)').matches)
            is_touch: false,
            // optional, arbitrary per-event-type data
            properties: { "product_id": "abc", "price": 9.99, "query": "red shoes" },
        }
    ]
}
```

Additionally, IP address, User-Agent, and geolocation data (via headers if deployed on a host that provides them) are implicit in the HTTP request.

**Infrastructure primitives consumed:** callback scheduling (setTimeout/setInterval style), HTTP client, Clock

**Concurrent-safety mechanism:** Each tab maintains its own in-memory queue independently, no concurrency concerns.

**Idempotency:** Retries send the same event `id`. Server handles duplicates.

**Error handling:**
- Any non-`response.ok` HTTP response or network error is treated as retirable
- Client tries every 5s indefinitely, queue is in-memory so will be dropped on tab close

**Discard policy:**
- Silently drop events where `transmit_time - create_time > 48 hours` (enforced client-side before transmission)
- Drop and log events above maximum volume (see §3.4)
- Drop and log individual fields of events above maximum size (see §3.4)

**Behaviour under load:** Applies rules in "Maximum Event Size & Volume" §3.4

**Memory usage:** In-memory queue of unsent events. Rate limiter caps capture at 10/s, but if transmission fails, events accumulate for up to 48h before discard. Worst case: 10 events/s × 172,800s = 1,728,000 events. ⚠ TBD: may need a max queue size cap to bound memory in constrained environments.

**Key behaviours:**
- Happy path: capture event -> add to in-memory queue -> debounce -> transmit -> `response.ok` -> remove from queue
- Debounce: design good scheme. Consider short initial window to collect burst, then longer repeating window. Prevent queue draining at more than 64kB per request (keepAlive limit) and wait for ack before sending more. Timeout and cancel requests.
- Retry on failure — all non-`response.ok` responses and network errors are retryable
- `fetch()` calls use `keepAlive: true` to permit sending events during unload, content type text/plain to avoid CORS preflight.
- Drop and console.error events above maximum size
- Individually drop properties of events above the count/size thresholds, without dropping whole event
- `transmit_time` updated on each retry attempt (consider envelope format that puts single `transmit_time` on wrapper and keeps events inside stringified)

**DST mock points:**
- HTTP client (POST to server — can fail, timeout, succeed but response lost)
- Callback scheduling (setTimeout/setInterval — for retry timing)
- Clock (for setting `transmit_time`, evaluating 48h discard rule)
- Random number generator (for generating event `id`)
- Network status (online/offline — for re-establishment trigger)

---

### 5.2 Server Event Capture

**Purpose:** Receives events from clients, performs timestamp correction and privacy processing, writes to queue.

**Inputs:** HTTP POST from Client Event Capture (§5.1) or JS SDK function.

**Outputs:** Pushes batches of events onto the queue (consumed by §5.3).

Events received as a batch are enqueued in one write, not unwrapped into individual messages.

```json5
{
    type: "events-ingest",
    // ISO 8601, earliest ingest_time in this batch
    min_ingest_time: "2026-04-05T14:23:01.456Z",
    // NDJSON string of event data, newline terminated for future concatenation
    events: "{\"id\":\"8371625098432175904\"..."
}
```

Format of individual events

```json5
{
    // Current server timestamp when event received from client
    ingest_time: "2026-04-05T14:23:01.456Z",
    // Even creation time after correction for unreliable client clocks
    create_time: "2026-04-05T14:23:01.456Z",
    // 32 bit hex privacy preserving hash of IP + user-agent + daily salt
    anon_session_id: "2a64046d",
    // anon_session_id calculated with the salt before the last rotation, for
    // session tracking across salt rotation boundaries
    prev_anon_session_id: "2a64046d",

    // Parsed from URL
    page_path: "/pricing",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "summer-sale",
    utm_term: "red-shoes",
    utm_content: "shoes-sale",
    click_param: "fbclid", // Name (not value) of click ID: gclid, gbraid, wbraid, msclkid, fbclid, twclid, dclid, ttclid, li_fat_id, null if not available

    // Inferred from headers, supporting Cloudflare, Vercel and other common hosts, null if not available
    geo_country: "GB",
    geo_region: "London",
    geo_city: "London",
    geo_lat: 51.50853,
    geo_lng: -0.07614,

    // Parsed from user agent
    browser_name: "Chrome",
    browser_version: "122", // Major version only
    os_name: "Windows",
    
    // Copied from source event
    id: "8371625098432175904",
    name: "pageview",
    project: "akujs.dev",
    user_id: "user-abc-123",
    session_id: "session-xyz-789",
    page_referrer: "https://google.com",
    page_title: "Pricing — Example",
    viewport_width: 1280,
    viewport_height: 720,
    is_touch: false,
    properties: { ... },
}
```

**Infrastructure primitives consumed:** HttpHandler, Queue, Clock, Object Storage (Via Salt Service)

**Concurrent-safety mechanism:** Stateless request handler. Multiple instances can run concurrently. Salt is read, not written.

**Idempotency:** Not idempotent — same event retried with different `transmit_time` produces different `create_time`. Deduplication happens later in pipeline.

**Error handling:**
- Queue enqueue failure: return error to client, client retries
- Salt read failure: return error to client, client retries

**Discard policy:**
- Drop events created more than 48h ago
- Drop whole batches with zero valid events, do not write to queue, report success

**Behaviour under load:** This is a high volume pressure point - potentially massive volume. Under extreme load, queue enqueue may slow or fail, causing HTTP errors, causing client retries, potentially amplifying load. This is not something we handle - the application needs to provide infrastructure that can handle this.

**Memory usage:** Stateless per-request. Memory = one request body + one enriched batch being enqueued. Bounded by max request size (64kB). Important invariant: no accumulation across requests.

**Key behaviours:**
- Happy path: receive POST -> enrich event -> add to queue -> respond success
- Tolerate missing or invalid data as much as possible, e.g. (non-exhaustive list, use your imagination):
  - generate id if missing / too short
  - allow some invalid events within a batch
  - if timestamps missing/invalid/in future then fall back to ingest_time
  - Apply maximum event size rules, discarding individual fields rather than the whole event (share impl function with client)
  - Log these only in debug logging mode.
- On failure of queue write or salt read, respond with error so client retries
- Drop stale events where `transmit_time - create_time > 48 hours`, log discard only in debug mode
- If client claims future event, clamp to ingest_time

**DST mock points:**
- Clock (for `ingest_time`)
- Queue (enqueue — can fail)
- Object Storage via Salt Storage - salt read can fail if object store is unavailable and no recent cached value
- HttpHandler (note the link between this and the client script needs design work, should be possible for request to reach server, be handled correctly, but advertised as a failure)

---

### 5.3 Transient Batch Writer

**Purpose:** Consumes event groups from the queue in larger batches, writes each batch to object storage as a single blob.

**Inputs:** `events-ingest` messages from Queue (written by §5.2), delivered in batches. Each message contains pre-serialised NDJSON in the `events` field and a pre-computed `min_ingest_time`. The queue batches messages together — a typical configuration might be "deliver 100 at a time, or 1 minute's worth, whichever comes first" — but this is configured at the infrastructure level, we're just given a queue interface, already configured.

**Outputs:** Batch objects in ObjectStore, one object per batch. These are "transient batches" — not yet aggregated into daily batches.

The format of the transient batch files is newline-delimited JSON, one event per `\n`, same event structure as in the `events-ingest` messages. File ends with trailing `\n` (important for future concatenation):

```json5
{"id":"8371625098432175904","ingest_time":"2026-04-05T14:23:01.456Z",...}
{"id":"3716843217590482509","ingest_time":"2026-04-05T14:23:03.385Z",...}
```

**Infrastructure primitives consumed:** Queue (consumer), ObjectStore

**Processing:**

1. Skip any messages with empty `events` string
2. Deduplicate messages by `events` string content (handles queue at-least-once redelivery of identical messages)
3. Sort all NDJSON lines lexicographically across all messages (for deterministic hashing — not semantic ordering)
4. Concatenate sorted lines, separated by `\n`, with trailing `\n`
5. Hash the concatenated string (pre-compression bytes) to produce content hash
6. Compute `min_ingest_time` as the minimum `min_ingest_time` across all messages
7. Generate object name as `transient/{min_ingest_time}-{hash}.ndjson.gz` where `min_ingest_time` is ISO 8601 basic format (e.g. `20260405T142301.456Z`) and `hash` is the content hash
8. Gzip compress and write to ObjectStore with `allowOverwrite: false`

**Idempotency:** Object name includes hash of pre-compression content. If the queue redelivers the exact same messages, the hash matches and the write is a no-op via `allowOverwrite: false`. If the queue redelivers the same messages in a different batch composition (mixed with other messages), the hash differs, producing a separate object with overlapping events — acceptable, dedup at §5.7 handles it.

**Concurrent-safety mechanism:** Writing to ObjectStore with `allowOverwrite: false` is concurrency-safe.

**Error handling:**
- ObjectStore write failure: handler throws, queue redelivers. Events are not lost.

**Discard policy:** No events discarded. Events arrive pre-serialised from §5.2, no serialisation failures possible.

**Behaviour under load:** This rests on basic cloud primitives, queue draining to object storage, assumed to be capable of very high throughput and not the bottleneck.

**Memory usage:** One batch of NDJSON strings + gzip buffer. Max batch = 100 messages × 64KB = 6.4MB.

**Key behaviours:**
- Happy path: receive batch of messages → skip empty → dedup → sort lines → hash → name → gzip → write to ObjectStore → handler returns → queue acks
- On ObjectStore write failure, handler throws — queue redelivers the messages

**DST mock points:**
- Queue (consumer — duplicate delivery, out-of-order delivery)
- ObjectStore (write failure, slow write, `allowOverwrite: false` rejection)

---

### 5.4 TO BE REFINED: Batch Aggregator

**Purpose:** Rolls up transient batches into daily batches. Groups by `ingest_time` date — a "daily batch for April 5th" contains all events *received* on April 5th, regardless of corrected client timestamps.

**Inputs:** Cron trigger (nightly). ⚠ TBD: should this use the cron->queue pattern for retry semantics?

**Outputs:** Daily batch objects in ObjectStore. Deletion of aggregated transient batches.

**Infrastructure primitives consumed:** CronScheduler (or Queue if cron->queue pattern), ObjectStore, Clock

**Processing:**
1. Triggered by cron
2. List transient batch objects for the target day
3. Read all transient batches
4. Write daily batch object with deterministic key (e.g. `daily/2026-04-05.batch`) — deterministic naming ensures duplicate runs overwrite rather than create duplicates
5. Confirm write succeeded
6. Delete transient batches

**Concurrent-safety mechanism:** Deterministic daily batch key means concurrent/duplicate runs produce the same object. Deletion of transient batches after write is idempotent (deleting already-deleted objects is a no-op or ignored).

**Idempotency:** Yes, in the happy path — same input produces same output at same key.

**Error handling:**
- ObjectStore list fails: abort, retry on next trigger
- ObjectStore read fails for a transient batch: ⚠ TBD — skip it? Abort whole aggregation?
- Daily batch write fails: abort, retry on next trigger. No transient batches deleted.
- Transient batch deletion fails after daily write: orphaned transient batches. Next run re-reads them but overwrites same daily key — safe but wasteful.

**Discard policy:** None — events are preserved, just reorganised.

**Behaviour under load:** Runs once nightly. Load concern is volume of transient batches to read. ⚠ TBD: what if a day has an extremely large number of transient batches?

**Memory usage:** Reads all transient batches for one day, merges, writes daily batch. Memory = one full day of events. ⚠ TBD: for high-volume sites this could be very large. May need streaming merge or chunked processing.

**Key behaviours:**
- Happy path: cron triggers -> list transient batches for target day -> read all -> write daily batch with deterministic key -> confirm write -> delete transient batches
- Daily batch key is deterministic from the date — duplicate runs overwrite, not duplicate
- Delete transient batches only after confirmed daily batch write
- Deduplicate by id within the batch
- Orphaned transient batches (deletion failed after write) are safe — next run re-reads and overwrites same key. NOTE: NOT TRUE! Partial deletes v dangerous here we could lose data, need to figure out how to handle
- Groups events by `ingest_time` date, not corrected client timestamp

**DST mock points:**
- CronScheduler (duplicate trigger, missed trigger)
- ObjectStore (list/read/write/delete failures, eventual consistency on list — recently written batch may be missing)
- Clock (for determining target day)

**Open questions:**
- What defines "the target day"? Yesterday only? All days with un-aggregated transient batches?
- Should this use cron->queue pattern for retry semantics?
- What if a transient batch is malformed or unreadable? Skip it? Abort?
- Is a daily batch one object per day, or could a high-volume day need multiple?
- If eventual consistency causes a transient batch to be missed, when does it get picked up?
- Daily batch serialisation format — same as transient batches?

---

### 5.5 TO BE REFINED: Salt Rotation

**Purpose:** Rotates the salt used by §5.2 to compute `client_id`. Keeps the previous day's salt available so sessions spanning midnight are not split.

**Inputs:** Cron trigger (daily). ⚠ TBD: should this use the cron->queue pattern for retry semantics?

**Outputs:** New salt written to [persistent object store](./persistent-object.md). Previous salt retained.

**Infrastructure primitives consumed:** CronScheduler (or Queue), [persistent object store](./persistent-object.md), random number generator (DST mock point per §7.1)

**Processing:**
1. Triggered by cron
2. Generate new salt (random — DST mock point)
3. Move current salt -> previous salt
4. Write new salt as current

**Concurrent-safety mechanism:** ⚠ TBD — what if cron fires twice?

**Idempotency:** Not idempotent — each run generates a new random salt. Duplicate triggers would rotate twice.

**Error handling:**
- Salt write failure: ⚠ TBD — request handlers continue using old salt? Is this acceptable?
- DST must exercise salt rotation failures

> ⚠ TBD: Design salt rotation using [persistent object store](./persistent-object.md). The persistent object store provides compare-and-swap and read caching, which should address atomicity and concurrent request handler reads. Needs a concrete design for the salt object shape (current + previous salt), rotation logic, and interaction with the caching layer.

**Discard policy:** N/A

**Behaviour under load:** N/A — runs once daily.

**Memory usage:** Two salt values in memory. Negligible.

**Key behaviours:**
- Happy path: cron triggers -> generate new salt -> move current salt to previous -> write new salt as current
- Previous day's salt is retained so `client_id` is stable across midnight for ongoing sessions
- On rotation failure, request handlers continue using the current salt — stale salt is acceptable
- Duplicate cron trigger would rotate twice, losing the previous salt prematurely

**DST mock points:**
- CronScheduler (duplicate trigger, missed trigger)
- [Persistent object store](./persistent-object.md) (write failure, read returning stale/cached value)
- Random number generator (salt generation)

**Open questions:**
- Where is salt stored? ObjectStore? Separate key-value primitive?
- Does the Plausible algorithm hash with the date as well as the salt?
- Exactly when does the previous salt expire? After 24h? After next rotation?
- How to prevent duplicate cron triggers from double-rotating?

---

### 5.6 TO BE REFINED: Event Server

**Purpose:** HTTP handler serving batch data to the Client Sync Engine (§5.7). Three APIs: catch-up (by time range), batch load (by name), batch manifest.

**Inputs:** HTTP requests from Client Sync Engine (§5.7)

**Outputs:** HTTP responses containing event data from ObjectStore (both transient and daily batches)

**Infrastructure primitives consumed:** HttpHandler, ObjectStore, Clock

**APIs:**
- **Catch-up:** accepts a time range, returns events from transient batches within that `ingest_time` range. Note: ~10s drift between server clocks means clients should request a slightly wider window than the exact desired range to avoid missing boundary events.
- **Batch load:** accepts one or more batch names, returns batch data. Used for loading daily batches individually.
- **Manifest:** returns a list of available batches (both transient and daily).

**Concurrent-safety mechanism:** Stateless read-only handler. Multiple instances can serve concurrently.

**Idempotency:** Yes — read-only operations.

**Error handling:**
- ObjectStore read failure: return error to client. Client retries.
- Batch deleted between manifest request and batch load (race with §5.4 aggregator): ⚠ TBD — return 404? Client should handle gracefully and re-request manifest.

**Discard policy:** None — read-only, no event mutation.

**Behaviour under load:** Read-only, scales horizontally. Concern is ObjectStore read throughput under many concurrent sync clients. ⚠ TBD: caching strategy?

**Memory usage:** Per-request: reads batch object(s) from ObjectStore, serves to client. Memory = one batch object per concurrent request. Bounded by batch object size. No accumulation. ⚠ TBD: if catch-up query spans many batches, does the server stream or buffer all in memory?

**Key behaviours:**
- Happy path (catch-up): receive time range -> identify matching transient batches by `ingest_time` -> read from ObjectStore -> return events
- Happy path (batch load): receive batch name(s) -> read from ObjectStore -> return batch data
- Happy path (manifest): list available batches (transient and daily) -> return manifest
- Catch-up queries index on `ingest_time`, not corrected client time
- Clients should request ~10s wider than their exact desired range to account for server clock drift
- If a batch is deleted by the aggregator (§5.4) between manifest and load, return 404 — client should re-request manifest

**DST mock points:**
- HttpHandler (malformed requests, timeouts)
- ObjectStore (read failure, object deleted between list and read)
- Clock (if any time-based logic e.g. cache headers)

**Open questions:**
- How does catch-up identify which transient batches overlap the time range? Time encoded in object key? Metadata index?
- Does the manifest include enough info for sync engine to detect what's changed? Event counts? Checksums?
- Pagination for large result sets?
- Authentication/authorization — in scope?
- Caching strategy for frequently-requested batches?

---

### 5.7 TO BE REFINED: Client Sync Engine

**Purpose:** Loads events from Event Server (§5.6) into a local DuckDB database. Deduplication happens at DuckDB insert, keyed on event `id`. This is the system's deduplication backstop (§1.3).

**Inputs:** HTTP responses from Event Server (§5.6)

**Outputs:** Events inserted into DuckDB (on Origin Private File System). This is the final destination.

**Infrastructure primitives consumed:** HTTP client, DuckDB (cannot fail for DST purposes)

**Deduplication:** On insert, if an event with the same `id` already exists, the new event is discarded. "First wins" — the first-ingested version (which may have a different `create_time` from a retry with different `transmit_time`) is the one kept.

**Concurrent-safety mechanism:** ⚠ TBD — can multiple sync operations run concurrently in the same browser? Probably not, but needs stating.

**Idempotency:** Yes — re-inserting the same events is safe due to dedup on `id`.

**Error handling:**
- HTTP request failure: retry. ⚠ TBD: retry strategy.
- Partial sync (loaded some batches, then failure): dedup means it's safe to re-request overlapping data on retry.

**Discard policy:** Duplicate events (same `id`) are silently discarded at insert.

**Behaviour under load:** Client-side, single user. Load concern is initial sync of a large dataset. ⚠ TBD: first-run bootstrap strategy for sites with months of history.

**Key behaviours:**
- Happy path:
  - Request manifest from event server
  - Determine which batches are new (compared to local state)
  - Load new batches (catch-up for recent transient, by name for daily)
  - Insert events into DuckDB, deduplicating on `id` — first ingestion wins
  - Update local sync cursor/watermark
- On HTTP failure mid-sync, safe to retry — dedup handles any overlap from partial progress
- Duplicate events across different batch objects (from §5.3 redelivery) are correctly deduped on `id`
- Sessionisation: login mid-session should not split the session

**DST mock points:**
- HTTP client (request failure, timeout, partial response)
- Clock (for polling interval, if applicable)
- Network status (online/offline, if sync triggers on reconnect)

**Open questions:**
- Sync protocol — watermark? Manifest diffing? How does it know what's new?
- Per-batch checkpointing to limit re-download after crash?
- DuckDB on OPFS has browser quota limits — retention/pruning policy?
- First-run bootstrap for sites with months of history — bulk load mechanism?
- Schema evolution — what when DuckDB encounters a field it hasn't seen?
- Sessionisation design — how are sessions defined and how does login not split them?


---

## 6. Testing Strategy

### 6.1 Unit Testing

> ⚠ TBD

### 6.2 DST Scenario Catalogue

Scenarios are added here as steps are defined in §5. Each scenario documents:

- The failure or concurrency condition being simulated
- Which infrastructure primitive mock is configured, and how
- The expected system outcome

> ⚠ Scenarios TBD — to grow with §5

### 6.3 Integration Testing

> ⚠ TBD

---

## 7. DST Mock Point Design

> ⚠ This section requires design work

DST Mock Points are designed to be minimal and single-purpose, not merely as an abstraction convenience but specifically to make mock implementations simple enough to be correct. The simulation harness controls time and injects failures through these interfaces, allowing any production failure scenario to be reproduced exactly in a test.

**Interface design rule:** if an interface would require a complex mock implementation, it is too broad and must be split.

### 7.1 Non-deterministic language APIs

The following categories of language-level API are sources of non-determinism and must be controlled under DST:

- **Current time** — `Date.now()`, `new Date()`, etc.
- **Delayed/scheduled callbacks** — `setTimeout`, `setInterval`, etc.
- **Random number generation** — `Math.random()`, `crypto.getRandomValues()`, UUID generation, etc.

> ⚠ TBD: Should pipeline code be prohibited from calling these APIs directly (enforced by lint rules or convention), or should they be monkey-patched globally by the DST harness? Trade-offs: banning direct calls makes the constraint explicit and testable but requires threading an interface through all code; monkey-patching is less invasive but harder to verify completeness and risks leaking real non-determinism.
