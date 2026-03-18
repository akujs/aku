# Code Review Orchestrator

## Invocation

You will be invoked with a **review scope description** to review, which will either be a set of files, such as a path to a folder, or a git range such as "Differences between this branch and main".

Generate a name for the review in the format `YYYY-MM-DD--hh-mm-short-description` where short-description is a short, descriptive name for the review in kebab-case.

Create the folder `automation/code-review/reviews/{review-name}`, henceforth called the **review folder path**.

## Phase 1: Unit discovery (sub-agent)

First, create the **scope of code** which is a checked and unambiguous version of the review scope description.

For example if asked to review "all files in the cli folder that have changed since this branch was created" you might verify that there is a cli folder, and that we are on a branch other than main. If there is any doubt or ambiguity here, stop and ask for use it for clarification.

Spawn a sub-agent to analyse the review target and produce a **review plan** — a text document listing flows and file groups.

The sub-agent receives:

- Instructions to follow the steps in `automation/code-review/unit-discovery-instructions.md`
- The **scope of code** to review
- The **review folder path**

It will write the results of its discovery to `{review-folder-path}/units.md`

### Present plan to user

Present the plan to the user for approval. The user may approve, modify, or remove units. Do not proceed to Phase 2 until the plan is approved.

## Phase 2: Parallel Review

Fan out one sub-agent per criteria file in `automation/code-review/criteria/`. Each sub-agent receives:
- The file path `automation/code-review/review-agent-instructions.md` — the agent reads this for output format, severity definitions, and general instructions
- Its assigned criteria file from `automation/code-review/criteria/`
- The approved review plan (the text from Phase 1)
- An output path for findings and summary files

Each sub-agent works through all units in the plan as a batch, producing one findings file and one summary.

## Phase 3: Deduplicate (sub-agent)

Spawn a sub-agent to deduplicate findings across all criteria agents.

The sub-agent receives:

- Instructions to follow the steps in `automation/code-review/deduplication-agent-instructions.md`
- The **review folder path**

It will write the deduplicated findings to `{review-folder-path}/findings.md`.

## Phase 4: Determine Next Steps

This section is still to be designed for the moment. Terminate when you reach this phase and report success to the user.