# Type Safety

Use the findings code TYPE.

Review the specified code for TypeScript type system correctness. Covers `any` usage where more specific types would work, type assertions (`as`) that bypass the type system in ways that could hide bugs, generic constraints that are too loose, and union types that are not handled exhaustively.

Be selective. A review that reports 30 minor issues is less useful than one that reports 5 important ones. Prioritise findings that affect type safety or could mask bugs at runtime.

## What to look for

You are looking for cases where the TypeScript type system is used incorrectly, bypassed, or relied upon in ways that could hide bugs. A non-exhaustive list of examples follows. You may also apply your general knowledge of TypeScript type safety.

### Type errors and incorrect types

- Types that do not accurately describe the runtime values they represent. For example, a function typed as returning `string` that can actually return `undefined`, or an interface property typed as `number` that may be `null`.
- Incorrect generic type parameters — a generic function or class instantiated with the wrong type argument, or a generic constraint that is too loose to prevent misuse.
- Discriminated unions where the discriminant field doesn't actually distinguish between all variants, or where a variant is missing from a union that should include it.

### Type assertions and unsound escape hatches

- Type assertions (`as`) that bypass the type system in ways that could hide bugs. An assertion from a narrow type to a wider one is usually safe; an assertion from `unknown` to a specific type without validation is not.
- Unsound type predicates and assertion functions — custom type guards (`x is Foo`) and assertion functions (`asserts x is Foo`) that don't actually validate what the return type claims. TypeScript trusts these entirely, so an incorrect predicate silently breaks the type system for all downstream code.
- Non-null assertions (`!`) used where the value could genuinely be `null` or `undefined` at runtime.

### `any` propagation

- A single `any` that enters a type chain silently disables type checking for everything downstream. Look for `any` entering through untyped dependencies, JSON parsing (`JSON.parse` returns `any`), or generic function returns, and then flowing through several layers before potentially causing a runtime error far from the source.
- Implicit `any` types that arise from missing type annotations in contexts where TypeScript cannot infer a more specific type.

### Type narrowing and control flow

- Type narrowing lost across boundaries — narrowing from an `if` check is lost inside callbacks, closures, and after `await` points. Code that looks like it's working with a narrowed type may actually be working with the wider type at runtime.
- Missing exhaustiveness checks on union types — a `switch` or `if`/`else` chain that handles some variants of a union but not all, without a compile-time exhaustiveness guard (e.g. `never` check in the default branch).
- Truthiness checks (`!value`, `value || default`) that incorrectly reject falsy-but-valid values like `0`, `false`, or `""`, where the type permits these values.

### Overly complex types

- Deeply nested conditional types, mapped types, or template literal types that are difficult to understand, verify, or maintain.
- Complex type-level computation that could be replaced with simpler alternatives or runtime validation.
- Types that are technically correct but so intricate that they are likely to be misunderstood or incorrectly modified during future maintenance.

### Brittle types and edge cases

- Index access unsoundness — `Record<string, T>`, index signatures, and array indexing all claim values exist at every key/index, but at runtime keys may be missing. Code that assumes a value is present without checking may fail at runtime.
- Incorrect generic variance — especially in function parameter and return positions. TypeScript's structural typing can allow substitutions that are covariant where they should be contravariant, leading to runtime type mismatches.
- Overloaded function signatures that don't match the implementation, or where overload ordering causes the wrong signature to be selected for certain inputs.
- Types that work correctly for common inputs but break for valid edge cases such as empty arrays, optional properties, or union members that have different shapes.

## Lint-disable comments

All lint-disable comments must have an explanation that starts with "Human approved: ". This indicates that a human has reviewed the lint suppression and confirmed it is necessary.

If a lint-disable comment does not start with "Human approved: ", flag it as a **Query** with a proposed fix to add the "Human approved:". The human reviewer will decide whether to approve it (adding the prefix), or refactor the code to eliminate the need for the suppression.

This rule exists because LLMs frequently add lint-disable comments rather than finding type-safe alternatives, and the `any` type in particular is often used where a more specific type would work.
