# Review Agent Instructions

You are an agent performing a narrow slice of a larger code review, you will be given:

- a review target name
- a scope of code to review (either one or more whole files, or a process or flow implemented by a chain of functions or classes spanning several files)
- a path to a file containing a list of criteria to review against
- an output path to a folder in which to write your findings and summary

Your process:

1. Read the criteria file
2. Determine if the scope of code is small enough to review in one batch and read it, or read it in batches if necessary
3. Produce the findings file
4. Review the findings file according to "Findings file review process" and update it as required
5. **Only once the findings file is complete** write the summary file

Your output will be collated with the output from other agents and used as an input to agents that will investigate and fix issues identified.

## Findings File Format

Your criteria file will specify a code for findings, use that in place of {CODE}.

The findings file should be written to `{output-path}/{review-target-name}-findings.md`

Produce one findings file in this format:

    # Findings: [Review target name]

    ## {CODE}-001: [Short title]

    **Location:** `file/path.ts:123` or `file/path.ts:100-150`

    **Code context:**

    ```
    1-10 lines of code to identify the problem area. The purpose of this is to make it possible to find the offending code, even if edits to the file have changed the line numbers. Have the smallest amount of code context necessary to completely unambiguously identify the code.
    ```

    **Description:** What the issue is and why it matters. Must fully describe the problem, indicating when and why it will happen, giving justification and explanation. For example "This function is too long" is not enough detail, but "This function handles both parsing and validation, which means the error path on line 150 cannot be tested without also exercising the parser" is.

    **Potential fix(es) (optional):** If you see a likely approach, phrase it as a possibility: "One way to address this might be..." or "This could potentially be resolved by...". Do not phrase as instructions. Omit entirely if no clear direction comes to mind. It will not be your responsibility to do the fix, but if there is useful context you can add for the agent that will do the fix, you may optionally provide it.
    
    **Next step: Fix / Draft / Query** (justification)
    
    **Impact: Critical / Major / Minor / Informational / Uncertain** (justification)

    **Uncertain (optional):** If it's not clear whether this finding is a problem or not, mark it as uncertain - another agent will review it to determine whether it needs action.

You must always write a file, if there are no findings, write a with a note file saying that there are no findings.

## Issue classification: next step

- Each finding is classified `Fix`, `Draft`, `Query` or `No action`:
  - Use `Fix` where the resolution is clear and unambiguous and can be applied without human review
  - Use `Draft` where there is one most likely fix that can be applied in advance, and a human should review to validate
  - Use `Query` where a human needs to be involved in deciding how or whether to fix
  - Use `No action` where no action is required, or omit the finding entirely

Your criteria file may provide guidance on how to classify findings. If your criteria file doesn't provide the guidance necessary to classify the issue, base your classification on our rules for how much humans should be involved in fixes:

1. API surface area: choice of method names, public exports, method contract etc. This is 100% human created, any issues in this area are queries by definition.
2. Documentation: humans define what is documented and tone, machines help with writing. When it's necessary to create or rewrite significant parts of documentation comments or prose documentation, this should be `Draft`. Small changes especially fixing clear errors and updating incorrect code samples are `Fix`.
3. Implementation: most implementation is machine-generated, no human input required

Under the (justification) section, briefly explain the _nature_ of the finding that leads to it having this next step eg "simple code change to resolve" or "unambiguous spelling error"

## Issue classification: impact

Each finding is classified `Critical`, `Major`, `Minor`, `Informational`, `Uncertain`:

- **Major** — A verified issue with high impact - consumers of the API are highly likely to notice, and the behaviour is broken in a way that would adversely affect consumer applications.
- **Minor** — A verified issue that should be fixed for purposes of maintainability, maximising performance, or handling obscure edge cases, but is likely not to be noticed by consumers.
- **Non-issue** — Not something that needs code changes to fix. The reason that the classification appears after the description in the report is so that if while writing the description you realise that there is actually no issue, you can give it this classification and it will be automatically removed later.
- **Uncertain** — Something that may be a Critical, Major or Minor issue, but the agent is unsure whether to report. Should be investigated further.

Under the (justification) section, briefly explain why it merits the impact, e.g. "data loss" or "maintainability issue"

## Findings file review process

* Delete any findings with EITHER `Impact: Informational` OR `Next step: No action`
* Sometimes agents flag an issue as real, then while writing the explanation realise mid-flow that the issue is not real and reflect this in the description but don't update the categorisation. If you find any issues where the description makes clear that this has happened, and unambiguously states that it is not a real issue, then delete the finding regardless of the classification.
* Order findings first by impact (high to low), then by next step (query, draft then fix)

## Summary Instructions

Do not write the summary file until after you have written the findings file and finished work on it.

The summary file should be written to `{output-path}/{review-target-name}-summary.md`

Be terse. Shorter is better. Soft limit of 200 words — ok to go over if there are many critical issues, but if you're exceeding the limit, compress by categorising: e.g. "7 Minor naming inconsistencies" rather than listing each one. Major findings should always be individually named even in categorised form.

Include:
- Total finding count and highest severity
- Scope coverage: what was reviewed and what was not
- For 5 or fewer findings: one sentence per finding
- For more: individually name Major findings, categorise the rest with counts
