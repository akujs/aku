# Test Quality

Use the findings code TESTQUAL.

Review whether existing tests are correct, well-implemented, and effective at catching regressions. This category focuses on the quality of the tests themselves — are assertions meaningful? Is test infrastructure well-designed? Would the test actually fail if the code under test were broken? This is a companion to the **test-coverage** criteria, which reviews whether the right set of tests exists. This category does NOT review whether the right tests exist. It also does NOT review whether test descriptions accurately describe what is tested.

Be selective. A review that reports 30 minor issues is less useful than one that reports 5 important ones. Prioritise findings that affect test reliability or could allow regressions to go undetected. After completing your review, re-read your findings and remove any `Minor` or `Informational` findings that are not pulling their weight, particularly if you have many `Minor`/`Informational` findings relative to `Critical`/`Major` ones. The goal is a review weighted towards reliability, not a comprehensive catalogue of style observations.

Note: the review unit for this category must include both implementation files and their corresponding test files.

## Criteria

You are looking for cases where existing tests are poorly implemented, misleading, or fail to provide the regression protection they appear to offer. A non-exhaustive list of examples follows. You may flag issues not covered by the categories below, but only if they would qualify as Critical or Major under the impact definitions above, and you must explain why the issue undermines regression protection.

### Meaningless assertions

LLMs have a specific failure mode when writing tests: they feel they "should assert something" and add assertions with no value. Every assertion in a test must directly help guarantee that the test title is true. The test title is the source of truth for what the test should verify.

Guard assertions that establish preconditions (e.g. confirming initial state before exercising behaviour) are acceptable when they protect against false passes — the test would silently pass if the precondition were already satisfied by accident. A guard assertion should verify a condition that the test relies on but does not itself create.

Flag assertions that don't help the test validate the thing it's testing.

### Tests that test the wrong thing

The test claims to verify X but actually verifies Y, or the assertion would pass even if the condition being tested is false.

### Assertion specificity

Assertions should be as specific as possible without being brittle. For example, asserting the full object is appropriate when the test controls all inputs; asserting only a subset is appropriate when the object includes fields populated by external systems or is likely to grow over time.

Inline snapshots are often an easy-to-update way of asserting function output, and the codebase prefers `toMatchInlineSnapshot()` over external snapshot files. Flag any use of `toMatchSnapshot()` as an issue.

### Generic test data

Use simple, neutral names (`A`, `B`, `C` or `item1`, `item2`) for these cases.

Also acceptable are generic relationship-based named liek `class Parent` and `class Child`.

Avoid domain-specific examples like `class Company` and `class Employee` that imply specific behaviour.

### Test brevity

A good test uses few lines to quickly set up the state, then few lines to assert. To achieve this, make use of shared fixtures, assertion helpers, and data-processing utilities where doing so improves readability and reduces duplication.

Flag cases where:

- The same class, data structure, or complex setup appears in three or more test files with trivial or no variation. Duplication across two files is usually acceptable — the maintenance cost of a shared fixture can exceed the cost of the duplication it removes.
- The same pattern of assertions is repeated in three or more places, or in two places where the repeated assertion logic is complex enough that a named helper would significantly improve readability
- A test contains complex data-processing logic to prepare values for assertion, where a shared utility would make the intent clearer
- Fixture or assertion-helper duplication makes it hard for a human reviewer to see what differs between tests

Some duplication is acceptable, and desirable, avoid over-abstraction.

### Setup/teardown and shared state

Use `beforeEach`/`afterEach` for setup that is genuinely identical across all tests in a `describe` block, particularly when the setup is incidental to what each test verifies (e.g. creating a fresh instance, resetting a mock). Keep setup inline when it is directly relevant to understanding the specific assertion the test makes.

When using `beforeEach` to share setup, ensure each test gets a fresh instance of any mutable state. The `let` + `beforeEach` pattern gives each test its own copy of mutable state, which is fine. The isolation concern arises only when state persists _across_ tests — see "Test isolation" below.

Flag cases where:

- Multiple tests in the same `describe` block repeat substantial identical setup (5+ lines of the same boilerplate) that could be lifted into `beforeEach`
- A test file has a long preamble of incidental setup in each test when the setup is the same across tests
- Shared state is set up in `beforeAll` where `beforeEach` would be safer for test isolation

Do not flag cases where extracting setup would obscure the relationship between the setup and the assertion. Short, test-specific setup (1-3 lines that directly create the input for that test) is better left inline even if it is repeated.

### Test isolation

Each test should be independent of other tests in the same file. Tests must not depend on execution order or on state left behind by previous tests.

Flag cases where:

- A test reads state that was written by a previous test rather than by its own setup
- Tests mutate shared state (module-level variables, singleton instances, global configuration) without resetting it in `afterEach`
- `beforeAll` is used to set up mutable state that individual tests then modify without cleanup

As a general heuristic, a test has an isolation problem if it would produce different results when run alone. Focus on detecting the concrete patterns above rather than attempting to reason about all possible orderings.

### Non-determinism and flakiness

Tests that fail intermittently undermine confidence in the test suite. Flag patterns that introduce non-deterministic behaviour.

Flag cases where:

- A test relies on specific timing (e.g. `setTimeout` with a hardcoded delay, or `sleep()` to wait for an async operation) rather than waiting for a deterministic signal
- A test depends on system-level state that may vary between environments (e.g. current working directory, environment variables, locale, timezone) without controlling or mocking it
- A test asserts on the order of items in a collection that has no guaranteed order (e.g. object keys, `Set` iteration, results from concurrent operations)
- A test uses `Date.now()` or `new Date()` directly, making assertions sensitive to execution speed

### Nesting of `describe()`

Avoid nesting `describe()` blocks. Don't add describe blocks just as a form of grouping and documentation - it's fine just to put similar tests together in one describe. Add describes where you need a `beforeEach` / `afterEach` scoped to a group of tests. Or when testing a different code unit, e.g. `describe(SomeClass, () => {...})`