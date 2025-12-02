# Beynac Coding Guidelines

Guidelines for Claude and other coding agents.

These guidelines must be followed when writing code for the Beynac project. After implementing any feature, review all code against these guidelines.

## Test Structure

- **describe() blocks**: When testing a particular function or class, pass the function/class reference directly as the first argument, NOT a string.
    - ✅ CORRECT: `describe(myFunc, () => { ... })`
    - ✅ CORRECT: `describe(MyClass, () => { ... })`
    - ❌ WRONG: `describe("myFunc", () => { ... })`
    - ❌ WRONG: `describe("MyClass", () => { ... })`
    - **NO EXCEPTIONS**: If you encounter an unnamed function that breaks the describe block, fix the function to have a name rather than passing a string to describe().

- **Async expectations**: In bun, expect never returns a promise
    - ✅ CORRECT: `expect(foo).toBe(bar)`
    - ❌ WRONG: `await expect(foo).toBe(bar)`

- **Type assertions**: Use `toEqualTypeOf` not the deprecated `toMatchTypeOf`
    - ✅ CORRECT: `expectTypeOf(value).toEqualTypeOf<Expected>()`
    - ❌ WRONG: `expectTypeOf(value).toMatchTypeOf<Expected>()`

## Code Style

- **Avoid `any` type**: Use `unknown` where possible. When type casting is necessary:
    - ✅ CORRECT: `foo = bar as TheCorrectType`
    - ❌ WRONG: `foo = bar as any`

- **Private methods**: Use true private fields with `#` prefix
    - ✅ CORRECT: `#privateMethod() { ... }`
    - ❌ WRONG: `private privateMethod() { ... }`

- **Optional parameters and properties**: Due to `--isolatedDeclarations`:
    - **Function/method parameters**: Optional parameters must NOT include `undefined` in their type
        - ✅ CORRECT: `function foo(opt?: string) { ... }`
        - ❌ WRONG: `function foo(opt?: string | undefined) { ... }`
    - **Object properties**: Optional properties MUST explicitly include `undefined` in their type
        - ✅ CORRECT: `{ optional?: string | undefined }`
        - ❌ WRONG: `{ optional?: string }`

- **Use static imports at the top of the file**
    - ✅ CORRECT: `import fs from "node:fs/promises";`
    - ❌ WRONG: `await import("node:fs/promises")` -- dynamic imports are not allowed
    - ❌ WRONG: `const promises = require("node:fs/promises")` -- require is not allowed, either at the top of files or in code
    - ❌ WRONG: `function processPath(path: string): import("node:path").ParsedPath` -- inline import in type annotation
    - If at any point it looks like using one of these patterns is the only way to implement a feature, stop and explain the issue. There is ALWAYS a better way.

- **Do not rename exports in barrel files**
    - ✅ CORRECT: `export { foo } from "./foo";`
    - ❌ WRONG: `export { foo as bar } from "./foo";`
    - If you discover a renamed export, consider the imported name to be correct, remove the renaming then update any dependent code to the correct name.

- **Do not export files from outside the folder in barrel files**
    - ❌ WRONG: `export { foo } from "../foo";`
    - This cannot be fixed automatically if you discover a violation, leave it in the code and ask what to do.

- **Avoid British/American ambiguity in public API**: avoid exporting values and public members that are spelled differently in British and American English
    - ✅ CORRECT: `export const cleanString = () => ...`
    - ❌ WRONG: `export const sanitiseString = () => ...` OR `const sanitizeString = () => ...`

## Documentation

TSDoc comments, markdown files and test names are all "documentation"

- **Use British English**: Use e.g. -ise instead of -ize, and all other British English rules, in doc comments, test names and markdown docs.
- **Ensure consistency and correctness**: Review the information in doc comments carefully looking for inconsistencies between what is documented and the actual method/parameter names and behaviour
- **tags in TSDoc**: where a function takes an optional object of parameters:
    - **Optional parameters in TSDoc**: where a function takes an optional object of parameters:
        - ✅ CORRECT: `@param [options.optName] - Description of option`
        - ❌ WRONG: `@param options.optName Description of option` - no square brackets or hyphen
        - ❌ WRONG: `@param options - Options to control behaviour` - the options parameter itself does not need a @param
    - **Obvious parameters in TSDoc**: where a function takes an argument whose behaviour is obvious, don't include a useless @param tag:
        - ❌ WRONG: `@param input - Input string` - stating the obvious
    - **@return tags in TSDoc**: Do not include these. The first sentence of the description should make the return value clear.
        - ❌ WRONG: `@return the input converted to lowercase` - instead, comment should start "Convert a string to lowercase"

## Linting

**CRITICAL: Never add lint-disable comments.** This includes:
- `// oxlint-disable`
- `// eslint-disable`
- `// biome-ignore`
- Any similar suppression comment

If a lint rule blocks your implementation:
1. Leave the lint error in place
2. Report it in your summary when finished
3. Let the human decide how to handle it

It is acceptable to leave unfixable lint errors. It is NOT acceptable to add disable comments.
