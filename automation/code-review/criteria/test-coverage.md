# Test Coverage

Use the findings code COVERAGE.

Review whether the code under review has an appropriate set of tests. This category focuses on what is tested and what is not — are the right behaviours covered? Are important edge cases exercised? Are there gaps where a regression could go undetected? Are there tests that add maintenance burden without catching real regressions?

This review is only concerned with what tests are defined and how they are organised. A different review process checks test quality. The hand-off between these two review processes is:

1. The test names. Your job is to ensure that implementation code has the correct set of tests defined by name, and that the name wholly encapsulates.
2. Organisation in `describe()` blocks. Your job is to ensure that tests are structured for clear understanding and maintenance
3. Comments **outside** of `test()` cases. You may add context comments outside of test cases to give context to the test quality reviewer. These should be at the file or `describe()` level - avoid commenting individual tests.
4. An exception to your instruction to focus on test names. You might encounter the right test with the wrong name. When proposing that tests are added or removed, first check that the the issue is not in fact incorrect test naming.

Note: you will be given a set of files to review, if this set does not include the tests for the implementation files, you ay expand it to include associated test files.

## Philosophy

The primary purpose of tests is to verify that the contract — whether documented or implied — is fully implemented. This includes positive and negative cases, happy paths and unusual paths. Edge cases that may plausibly break should be tested proactively. When reviewing, check whether regressions discovered through bug reports have corresponding tests — a bug fix without a regression test leaves the same behaviour vulnerable to reintroduction.

The goal is a reasonable and realistic set of positive, negative, and edge case tests — not a large collection of fuzz inputs or obscure scenarios. Where the API offers options that clearly interact and create a bounded set of permutations, exhaustive testing of every combination is desirable. For example, a CLI argument can be required/optional, single/array, or positional/named — testing every combination is useful. But exhaustively testing every combination of unrelated or independent options is not.

When reviewing, focus on gaps that could allow a regression to go undetected, or useless tests that add no value. If every section of this document has been considered and no gaps are found, the test suite is adequate — there is no need to manufacture findings.

## Criteria

Infer criteria from the above philosophy.

Consider whether flows should have integration-style tests, and whether files / functions should have unit style tests.

In general, prefer integration tests and use unit tests where a unit has specific behaviour that it's cumbersome to test in the context of an integration test.

It is NOT an error if a file lacks a unit test but that case is covered by the integration test.