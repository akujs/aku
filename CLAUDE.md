# Agent Instructions for Aku

## General instructions for tasks

Before working on a task, we will agree a plan. Follow this plan closely. If the agreed approach turns out to be impossible or significantly more complex than expected, **STOP and summarise the problems**. In particular, don't install packages, make changes to build files, project setup, or code outside the scope of what you're working on.

- After you have finished a task, run the formatter then check for issues with `bun check`. Only fix issues that are related to the code you're working on. If there are unrelated lint or test issues elsewhere in the codebase report them but no not fix them.
- Once the tests and lint check have passed, review your code against CLAUDE_CODING_GUIDELINES.md to ensure all guidelines are followed.
- After reviewing against guidelines, check for any other issues and potential improvements but DO NOT make them yet. Report these to me and let me decide if I want to make the changes.
- **DO NOT USE `git checkout `**. In the past it has led to significant loss of work where all changes are lost, when you only intended a more minor reset. Instead, if believe you need to use a checkout operation, stop and report the issue to the user to decide what to do and ensure that no work is lost.


## Build & Test Commands

- **Run unit tests**: `bun check:test` (extra params can be added directly, e.g. `bun check:test file-pattern -t TestNamePattern`)
- **Run type checking**: `bun check:ts`
- **Run lint and format test**: `bun check:lint`
- **Apply correct formatting to files**: `bun format` - IMPORTANT: always run checks (`bun check`) THEN format (`bun format`) after completing functionality changes
- If S3 tests fail with "XMinioStorageFull", restart MinIO: `docker compose down && docker compose up -d`

# Coding guidelines

These guidelines must be followed when writing code for the Aku project. After implementing any feature, review all code against these guidelines.

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

- **Mocking**: Do not explicitly call mockRestore() after tests that use mocking, as we do that in common test setup anyway

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

- **Avoid British/American ambiguity in public API**: avoid exporting values and public members that are spelled differently in British and American English
    - ✅ CORRECT: `export const cleanString = () => ...`
    - ❌ WRONG: `export const sanitiseString = () => ...` OR `const sanitizeString = () => ...`

- **Acronyms in identifiers**: Use Initial-Cap casing for acronyms (first letter uppercase, rest lowercase), regardless of position in the identifier
    - ✅ CORRECT: `HttpClient`, `parseUrl`, `SqlApi`, `getJson`
    - ❌ WRONG: `HTTPClient`, `parseURL`, `SQLAPI`, `getJSON`
    - This applies to all identifiers: classes, interfaces, types, functions, variables, and methods
    - File names use lowercase with hyphens: `http-client.ts`, `terminal-ui.ts`

## Documentation

TSDoc comments, markdown files and test names are all "documentation"

- **Use British English**: Use e.g. -ise instead of -ize, and all other British English rules, in doc comments, test names and markdown docs.
- **Ensure consistency and correctness**: Review the information in doc comments carefully looking for inconsistencies between what is documented and the actual method/parameter names and behaviour
- **tags in TSDoc**: where a function takes an optional object of parameters:
    - **Optional parameters in TSDoc**: where a function takes an optional object of parameters:
        - ✅ CORRECT: `@param options.optName - Description of option` - description with no square brackets around the parameter name
        - ❌ WRONG: `@param options - Options to control behaviour` - the options parameter itself does not need a @param
    - **Obvious parameters in TSDoc**: where a function takes an argument whose behaviour is obvious, don't include a useless @param tag:
        - ❌ WRONG: `@param input - Input string` - stating the obvious
    - **@return tags in TSDoc**: Do not include these. The first sentence of the description should make the return value clear.
        - ❌ WRONG: `@return the input converted to lowercase` - instead, comment should start "Convert a string to lowercase"
- Do not use // line comments for documentation of classes and exports, only for explaining unusual lines of code. If the linter complains about a doc comment on a non-public class, remove the comment entirely rather than converting to line comments.

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
