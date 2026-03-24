# Correctness

Use the findings code CORRECTNESS.

Review the specified code for correctness. Look for logic errors, incorrect assumptions, and edge cases that could cause the code to produce wrong results.

Be selective. A review that reports 30 minor issues is less useful than one that reports 5 important ones. Prioritise findings that affect correctness or could cause confusing behaviour for API consumers.

## What to look for

You are looking at all cases where the code does not achieve its goal due to incorrectness or failure to handle edge cases.

A non exhaustive list of examples follows. You may use your general knowledge of code correctness.

### Logic errors

- Inverted conditions, wrong operators (`<` vs `<=`, `&&` vs `||`), negation errors
- Incorrect data transformations — map/filter/reduce chains that silently produce wrong results, wrong sort comparator, wrong grouping key, accumulator initialised to the wrong value

### Semantic mismatches

- Does the implementation match what the function name, documentation, or types promise?
- Does the return value match the stated contract?

### Stale or inconsistent derived state

- Can computed or cached values get out of sync with their source data?
- Are there two fields that should be updated together but could be updated independently?

### Copy vs reference mistakes

- Is a shared object mutated when a copy was intended, or vice versa?
- Is a shallow copy used where a deep copy is needed?

### Incorrect equality and comparison

- Reference equality where value equality is needed, or vice versa
- Locale-sensitive string comparison where it shouldn't be, or vice versa
- Comparing values of different units or types

### Wrong assumptions about library or API behaviour

- Are there incorrect expectations about what a function returns, its side effects, or its success-path behaviour?

### Empty, null, and undefined inputs

- How does the code handle empty strings, empty arrays, empty objects?
- Are `null` and `undefined` treated consistently? Are there paths where one is handled but the other is not?
- Are there truthiness checks (`!value`, `value || default`) that would incorrectly reject falsy-but-valid values like `0`, `false`, or `""`?

### Boundary conditions

- Off-by-one errors in loops, slicing, or index calculations
- Integer overflow or floating-point precision issues where relevant
- First and last elements of collections — are they handled the same as middle elements?
- Empty collections — does the code work correctly with zero items?

### Unusual but valid inputs

- What happens with valid but uncommon inputs that callers might realistically provide?
- Are there implicit assumptions about input shape that are not enforced by types? (e.g. assuming an array is non-empty, assuming a string matches a pattern)
- Do regex patterns handle all valid inputs, or do they silently fail on edge cases?

### State and ordering

- Does the code depend on methods being called in a particular order? If so, what happens when they are called out of order?
- Can the same method be called twice, and if so, is the second call handled correctly (idempotent, error, or expected state change)?

### Resource management

When handling resources like f file handles and database connections that need closing, are they correctly handled in all control flow scenarios?