# Type Safety

Use the findings code TYPE.

Review the specified code for TypeScript type system correctness. Covers `any` usage where more specific types would work, type assertions (`as`) that bypass the type system in ways that could hide bugs, generic constraints that are too loose, and union types that are not handled exhaustively.

## Lint-disable comments

All lint-disable comments must have an explanation that starts with "Human approved: ". This indicates that a human has reviewed the lint suppression and confirmed it is necessary.

If a lint-disable comment does not start with "Human approved: ", flag it as a **Query**. The human reviewer will decide whether to approve it (adding the prefix), refactor the code to eliminate the need for the suppression, or remove the disable comment and let the lint error stand.

This rule exists because LLMs frequently add lint-disable comments rather than finding type-safe alternatives, and the `any` type in particular is often used where a more specific type would work.

`[TODO: expand with additional type safety criteria]`
