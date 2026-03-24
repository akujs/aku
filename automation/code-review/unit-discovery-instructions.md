# Unit Discovery Instructions

You are a sub-agent, invoked by an orchestrator agent, responsible for analysing a codebase and breaking it into review units. You write a report detailing the review units and then stop, returning control to the orchestrator who will present the plan  to the user for approval before review agents begin work.

## Input

You will receive:

- This file of instructions
- A **scope of code** — what code to review. This may be a folder path, a set of files, or a git range
- A **review folder path** to write the report to
- Access to the full codebase for context

## Process

### 1. Identify flows

Analyse the codebase within the scope to identify major flows.

A flow is a chain of operations triggered by an external input or event, where **data undergoes transformation or decision-making as it crosses file boundaries**, creating implicit contracts between files about data shape, state, or semantics. It begins with an input, passes through processing stages in different files, and produces an outcome. Flows typically involve three or more files, but can involve two if there is genuine handing off of responsibility rather than just calling a utility.

**Not flows:** utility calls, simple delegation, shared infrastructure.

**Flows:** input → parse → validate → process → respond; event → state lookup → mutation → side effects; command → plan → execute → aggregate; and similar.

When reviewing a diff rather than whole files: identify all flows that **pass through any changed file**. The flow is the unit of review even if only one function was altered.

### 2. Determine file coverage

For each file in a flow, assess whether it exists solely to participate in that flow. Files with no independent responsibility are **wholly covered** by the flow and do not need a separate file-based unit. Files that participate in a flow but also have independent responsibilities should still get their own file-based unit.

### 3. Group remaining files

Group all files not wholly covered by a flow into file-based units:

- **Large files >400 lines:** typically one unit per file.
- **Related files** may be grouped if total is under ~800 lines and they are cohesive.
- **Do not split a single class or cohesive abstraction across units.**

### 4. Write the units.md file

You may do whatever analysis and internal reasoning you need, remembering information and storing data in temporary files if necessary. When you are finished, format a report using the output format below and write it to `{review-folder-path}/units.md`. Output a brief note to the orchestrator agent telling it that you have finished.

## Output format

The output lists flows first, then file groups. Be dense — this is a working document for review agents, not prose.

For each file, the **To review** annotation describes what the review agent should focus on: specific methods, line ranges, or "Whole file". For flows, each file also has a **Role** describing its part in the flow.

### Example output

```
# Review Plan

## Flows

### Flow: HTTP Request Lifecycle
Incoming request → route matching → middleware chain → handler → response serialisation.

Data lifecycle: `Request` enters at `server.ts:handleRequest`, gains `RouteMatch` from `router.ts:resolve`, is wrapped in `RequestContext` by `middleware.ts:buildContext`, handler receives context and returns `ResponseBody`, serialised by `response.ts:send`.

Implicit contracts:
- `router.ts` assumes route patterns registered by `server.ts:register` are valid regexes
- `middleware.ts` assumes `RouteMatch.params` keys match handler parameter names
- `response.ts` assumes `ResponseBody.headers` are already validated

Files:
- `src/server.ts` — Role: entry point, dispatches to router. To review: `handleRequest` (lines 45-120), `register` (lines 20-40)
- `src/router.ts` — Role: matches URL to route, returns params. To review: whole file
- `src/middleware.ts` — Role: builds context, runs middleware chain. To review: `buildContext` (lines 30-85)
- `src/response.ts` — Role: serialises handler return value to HTTP response. To review: `send`, `serialiseBody`

### Flow: WebSocket Connection Upgrade
HTTP upgrade request → protocol negotiation → connection registry → message pump.

Data lifecycle: upgrade request enters at `server.ts:handleUpgrade`, `ws-handshake.ts` validates headers and negotiates protocol, `connection-registry.ts` tracks the socket, `message-pump.ts` manages read/write loops.

Implicit contracts:
- `ws-handshake.ts` assumes `Sec-WebSocket-Key` header is present (server.ts should reject before reaching handshake)
- `message-pump.ts` assumes connection is fully established before first read

Files:
- `src/server.ts` — Role: detects upgrade, delegates. To review: `handleUpgrade` (lines 130-160)
- `src/ws-handshake.ts` — Role: validates and completes handshake. To review: whole file
- `src/connection-registry.ts` — Role: tracks active connections. To review: `add`, `remove`, `getAll`
- `src/message-pump.ts` — Role: bidirectional message loop. To review: whole file

## File Groups

### Config and Environment
- `src/config.ts` — To review: whole file
- `src/env.ts` — To review: `loadEnv`, `validateRequired`

### Route Helpers
- `src/route-helpers.ts` — To review: whole file
- `src/route-types.ts` — To review: whole file
```
