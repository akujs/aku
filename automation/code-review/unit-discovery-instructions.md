# Unit Discovery Instructions

You are a sub-agent responsible for analysing a codebase and breaking it into review units. You will produce a set of unit files that other agents will use as their review briefs.

## Input

You will receive:

- A **review folder path** — the directory where you write your outputs (e.g. `automation/code-review/reviews/2025-03-15-14-30-http-refactor/`)
- A **scope description** — an unambiguous description of the changes under review. This may be whole files, or specific parts of files
- Access to the full codebase for context - if you need information that has not been provided to you, you may look it up

## Process

### Step 1: Identify flows

Analyse the codebase within and around the scope of review to identify major flows.

A flow is a chain of operations triggered by an external input or event, where **data undergoes transformation or decision-making as it crosses file boundaries**, creating implicit contracts between files about data shape, state, or semantics. The flow has a meaningful lifecycle: it begins with an input, passes through processing stages in different files, and produces an outcome. Flows typically involve three or more files, but in some cases can involve only two files if it involves genuine handing off of responsibility from one system to another, rather than just calling a utility function.

**Do NOT count as flows:**

- A file calling a utility function in another file (the utility's contract is self-contained)
- Simple delegation where A calls B and returns the result unchanged
- Shared infrastructure like logging or configuration

**DO count as flows (non-exhaustive list):**

- External input → parsing → validation → processing → response
- Event received → state lookup → state mutation → side effects
- User command → plan construction → execution → result aggregation
- Other similar patterns

For each flow, determine:

- A short descriptive name (used as the unit filename, e.g. `flow-http-request-lifecycle`)
- A one-line description of what the flow does
- The list of files involved, and key symbols in each file
- What data enters the flow, how it is transformed at each stage, and what comes out
- The implicit contracts between files (assumptions each file makes about what adjacent files produce or consume)

When reviewing a diff rather than whole files/folders: identify all flows in the module that **pass through any changed file**. The flow is the unit of review even if only one function in one file was altered — the purpose is to review that change in the context of the full flow.

### Step 2: Determine file coverage by flows

For each file involved in a flow, assess whether the file exists solely to participate in that flow. If the file has no independent responsibility — its only purpose is to serve as a stage in this flow — mark it as **wholly covered** by the flow. These files do not need a separate file-based review unit.

Files that participate in a flow but also have independent responsibilities should still receive their own file-based review unit.

### Step 3: Group remaining files into file-based units

Take all files in the scope of review that are **not wholly covered** by a flow and group them into file-based review units.

Guidelines for composing file-based review units:

- **Large files >400 lines:** one review unit per file.
- **Small related files** (e.g. a type file, its implementation, and its helpers) may be grouped into one unit if the total is under ~800 lines and the files are cohesive — they implement the same feature or abstraction.
- **Do not split a single class or cohesive abstraction across units.** Keep code together that needs to be understood together.

Give each unit a short descriptive name (used as the filename, e.g. `unit-route-helpers`).

### Step 4: Annotate changes

For every unit (flow or file-based), annotate each file with its change status:

- **changed** — this file was modified in the diff. Include a description of what changed: line ranges, added/modified/deleted functions or methods, new exports, changed signatures, etc.
- **context** — this file was not modified, but is included so the reviewer can understand the surrounding code. For flows, context files are stages in the flow that were not themselves changed. For file units, context files are closely related files that help the reviewer understand the changed code.

When reviewing a whole module rather than a diff, all files are implicitly "changed" (everything is in scope for review). Omit change annotations and include an instruction to review the whole file.

### Step 5: Assign criteria

For each unit, list which criteria categories (from `automation/code-review/criteria/`) should be applied. The default is to include every criteria category. Omit a criteria only when it clearly does not apply — for example, concurrency criteria can be omitted for review units that contain no asynchronous code.

### Step 6: Write output

Write one markdown file per review unit to `{review-folder}/units/`.

Naming convention:
- Flow units: `flow-{descriptive-name}.md`
- File units: `file-{descriptive-name}.md`

After writing all unit files, return a **plan summary** to the orchestrator (not written to disk — returned as your response). The plan summary should contain, for each unit:

- The unit name
- Type: `flow` or `file`
- A one-line description
- The list of files (names only, not full details)
- The list of assigned criteria
- The file path to the unit file on disk

This summary is what the orchestrator presents to the human for approval. It must be compact enough to scan quickly.

## Unit file format

### Flow unit

```markdown
# Flow: [Descriptive Name]

## Description

[One to three sentences describing what this flow does, what triggers it, and what the outcome is.]

## Data Lifecycle

[Describe what data enters the flow, how it is transformed at each stage, and what comes out. This is the core briefing that distinguishes a flow review from reading the same files independently.]

## Files

### 1. `path/to/first-file.ts` (changed)

**Changes:** [Description of what was modified — e.g. "Lines 50-60: constraint checking logic rewritten to support wildcards", or "New method `resolveWithFallback` added".]

**Role in flow:** [What this file does in the context of the flow — e.g. "Receives Request, searches route tree, returns RouteWithParams".]

### 2. `path/to/second-file.ts` (context)

**Role in flow:** [What this file does in the context of the flow.]

### 3. `path/to/third-file.ts` (changed)

**Changes:** [Description of changes.]

**Role in flow:** [What this file does in the context of the flow.]

## Implicit Contracts

[Bullet list of assumptions each file makes about what adjacent files produce or consume. These are the things most likely to break when one file is changed without updating another. This is the highest-value section of a flow review brief — it tells the reviewer exactly where to look for integration issues.]

## Criteria

- [criteria-name-1]
- [criteria-name-2]
```

### File-based unit

```markdown
# Unit: [Descriptive Name]

## Description

[One to three sentences describing what this code does.]

## Files

### `path/to/file.ts` (changed)

**Changes:** [Description of what was modified.]

### `path/to/related-file.ts` (context)

[No changes section needed for context files.]

## Criteria

- [criteria-name-1]
- [criteria-name-2]
```

### Whole-module review variant

When reviewing a whole module rather than a diff, omit the `(changed)` / `(context)` annotations and the **Changes** sections. All files are in scope. The **Role in flow** sections for flow units and the **Description** for file units are still required.
