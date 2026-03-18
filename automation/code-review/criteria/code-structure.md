# Code Structure

Use the findings code STRUCTURE.

The code structure review focuses on the structure of the codebase, including the organisation of files and modules, and the relationships between them. By definition it covers issues where even though the code is functionally correct, it is organized in such a way that it may cause problems for maintenance, analysis, or understanding by humans or machines.

## Classifying findings

Then determine the `invasiveness` of the fix:

- NON-INVASIVE: The change is safe to perform mechanically by moving things around. This is less about the number of changes than how safe they are. Moving around bits of code is generally safe.
- INVASIVE: The changes required are more involved than simply moving bits of code around. It is necessary to significantly change the philosophy of the way that the code is structured. For example, by changing the contract of a complex class, Splitting responsibility is differently between modules, or changing the architecture of a multi-layered module.

To classify a code structure finding, first determine the `importance` on a scale of 1 to 5:
1. I would have written it differently, but leaving it as is won't cause issues
2. It would be an unambiguous, though minor, improvement to change the structure
3. The current structure is likely to cause some confusion or slow down later maintenance
4. The current structure could be a significant barrier to maintenance and understanding
5. It is flat out wrong: any reasonable human or machine looking at this would say that it is structured incorrectly

### Impact

* If `importance` is 1, use `Impact: Informational` or omit the finding
* If `importance` is 2 or 3:
  * if `invasiveness` is INVASIVE, use `Impact: Informational` or omit the finding
  * if `invasiveness` is NON-INVASIVE, use `Impact: Minor`
* If `importance` is 4 or 5, use `Impact: Major`

### Next step

* If `invasiveness` is NON-INVASIVE, use `Next step: Fix` or omit the finding
* If `invasiveness` is INVASIVE:
  * if `importance` is 1, 2, or 3, use `Next step: No action`
  * if `importance` is 4 or 5, use `Next step: Query`

## Criteria

The following is a non-exist exhaustive list of criteria. You may also apply your general knowledge of good code structure.

### Module and file organisation

- Are responsibilities split sensibly across files? Are there files doing too many unrelated things, or related logic scattered across many files?
- Do file names clearly reflect their contents?

### Dependency direction

- Do dependencies flow in a sensible direction? Are there circular dependencies or cases where a low-level module imports from a high-level one?
- Are internal implementation details of one module accessed directly by another, rather than going through a defined interface?

### Layering

- Is there a clear separation between business logic, I/O, and coordination?
- Or are concerns tangled together in ways that make the code harder to test or reason about?

### Function and class cohesion

- Are individual functions and classes doing one coherent thing?
- Are there god-functions or god-classes that accumulate unrelated responsibilities?

### Duplication

- Is there duplicated logic that should be shared?
- Conversely, is there over-abstracted shared code that is actually serving different purposes and would be clearer as separate implementations?

### Control flow clarity

- Are there deeply nested conditionals, convoluted early-return patterns, or complex state machines that could be simplified?
- Is the control flow easy to follow for someone unfamiliar with the code?

### Side effects and mutability

- Are side effects (file I/O, network calls, logging, modifying shared state) confined to a thin outer layer that coordinates between pure logic and the outside world? Or do functions deep in the call stack perform I/O or mutate distant state, making them harder to test and reason about in isolation?
- Is mutable state used where immutable alternatives would be clearer and safer?
