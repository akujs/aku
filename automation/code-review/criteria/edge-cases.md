# Edge Cases

Use the findings code EDGE.

Review the specified code for edge case handling. Focus on inputs and states that are valid but unusual, and on boundary conditions that are easy to get wrong.

Be selective. A review that reports 30 minor issues is less useful than one that reports 5 important ones. Prioritise findings that affect correctness or could cause confusing behaviour for API consumers.

## What to look for

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

Note: race conditions and shared mutable state under concurrent access are covered by the **concurrency** criteria. Error path completeness and resource cleanup are covered by **error-handling** and **resource-management** respectively.
