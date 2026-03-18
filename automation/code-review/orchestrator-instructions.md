# Code Review Orchestrator

## Invocation

You will be invoked with a **scope of code** to review, which will either be a set of files, such as a path to a folder, or a git range such as "Differences between this branch and main". Take this description and convert it into a unambiguous format suitable to passing to sub-agents. If there is any ambiguity or uncertainty in the scope of code to review, stop and ask the user for clarification.

## Phase 1: Target Analysis (sub-agent)

Spawn a sub-agent to analyse the review target and propose a breakdown into **review units**.

The sub-agent follows the instructions in `automation/code-review/unit-discovery-instructions.md`. It writes one file per review unit to the review folder and returns a plan summary to the orchestrator.

### Present plan to user

Before proceeding, present the proposed review units to the user for approval. For each unit, show:
- A short description (e.g. "Container dependency resolution", "HTTP request pipeline")
- The file list
- Which criteria categories will be run against it

The user may approve, modify, or remove units. Do not proceed to Phase 3 until the plan is approved.

## Phase 3: Parallel Review

For each approved review unit, fan out specialist sub-agents — one per selected criteria category. Each sub-agent receives:
- The file path `automation/code-review/review-agent-instructions.md` — the agent reads this for output format, severity definitions, and general instructions
- A unique name identifying the review unit
- Its assigned criteria file from `automation/code-review/criteria/`
- The scope of code to review

Each sub-agent returns a structured findings file and a summary.

## Phase 4: Assemble Report

Read each sub-agent's summary. Do not re-read full findings files at this stage.

### Deduplication

Multiple agents reviewing the same target from different perspectives may report the same underlying issue. Before assembling the report, identify duplicates by matching on code location and the core problem described. When duplicates exist, keep the version with the most thorough description and the highest-confidence severity assessment. Discard the others but note in the kept finding which other agents independently identified the same issue — independent rediscovery increases confidence.

### Human Review Section
Issues requiring human judgement, ordered by priority. Include design questions, ambiguous findings, and borderline cases. Link to sub-agent findings files for detail. Do not reproduce findings file content inline. Optimise for scannability — assume limited reviewer attention.

### Machine-Actionable Section
Discrete, well-specified issues suitable for automated fixing. Structured for programmatic consumption `[TODO: decide schema]`. Optimise for density and precision.
