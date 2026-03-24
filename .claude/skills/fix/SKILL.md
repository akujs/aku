---
name: fix
description: Implement a bug fix or code cleanup with test-first methodology
disable-model-invocation: true
argument-hint: [description of the fix]
context: fork
---

# Fix: $ARGUMENTS

## Step 1: Analyse

Thoroughly analyse the codebase to understand:
- The area of code affected
- The root cause of the issue
- How the fix should be implemented
- Whether this is a **behaviour fix** or **code cleanup** (reorganisation, removing duplication, etc.)

## Step 2: Test first (behaviour fixes only)

Skip this step for code cleanup tasks.

For behaviour fixes, first locate the existing test file(s) for the affected code. Examine the existing tests to determine:
- Is there an existing test that *should* assert the correct behaviour but doesn't? If so, modify that test to assert the correct behaviour.
- If no existing test covers this scenario, add a new test in the appropriate location next to similar tests in the existing test file.

Once you've identified where the test belongs, write a **failing test** that demonstrates the incorrect behaviour:

- Run the test to confirm it fails for the right reason (i.e. the assertion fails because of the bug, not because of a syntax error or unrelated problem)
- If it's not possible to write this test (e.g. the behaviour depends on external systems, timing, or is otherwise impractical to unit test), create the test with the correct name but implement it as:
  ```ts
  throw new Error("TODO: implement this test. NOTE: DO NOT REMOVE THIS TEST UNTIL IT IS REPLACED WITH A REAL IMPLEMENTATION");
  ```
  Add a comment above the test explaining why it could not be implemented.

## Step 3: Implement the fix

Implement the minimum change needed to fix the issue.

## Step 4: Review the diff

Review the complete diff of your changes. Ask:
- Can this be more elegant?
- Can the diff be smaller while achieving the same result?
- Is the changed code clear and readable?

If yes to any, make at most one improvement pass.

## Step 5: Verify tests

Run the tests. If a TODO test was created in step 2, and during implementation it became clear how to write a real test, you MAY replace it — but ONLY if the test is high quality. Rules:

- A TODO test left in place = **success**
- A high quality test that genuinely verifies the fix = **success**
- A low quality test (passes without the fix, tests irrelevant things, contains hacks) = **failure**

## Step 6: Review test quality

Review the test and the fix together from scratch:

1. Does each assertion actually test the fix? Could the assertion pass even without the fix? If so, it's low quality — fix or remove it.
2. Are there irrelevant assertions not connected to the fix? Remove them.
3. Does the test exercise the specific scenario that was broken? If not, rewrite it.

If the test cannot be made high quality, revert it back to the TODO form.

## Step 7: Final checks

Run the project's standard checks (formatter, linter, type checker, tests) and fix any issues related to your changes.

## Step 8: Commit

Commit all changes with a clear, descriptive commit message. The first line should summarise the fix. The commit message body may include queries or notes for a human reviewer if anything warrants their attention (e.g. trade-offs made, areas of uncertainty, related issues spotted but not addressed).
