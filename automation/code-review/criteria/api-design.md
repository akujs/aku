# API Design and Intent

Use the findings code DESIGN.

The module containing code should have a design intent document at `src/{module-name}/{module-name}-design-intent.md`.

If this document does not exist, raise a single `Query` / `Major` finding pointing out that the design intent document is missing, then terminate.

The purpose of this review stage is to check that the module provides the right set of capabilities to implement the design intent. Focus on what can be done using the API, and whether there are functional gaps or instances of confusing and unnecessary functional duplication.

## Research

Before starting the review, research open source and commercial products that have similar functionality to the feature under review. However, do not assume that existing products have a good design. Just use it to become familiar with the design space.

## Classifying findings

- Any proposed change that affects the typescript type or semantics semantics of the API is a `Query`
- Substantive documentation where you propose adding, editing or removing content are `Draft`
- Changes like fixing spelling errors, converting documentation comments from American to British English, and fixing clear errors in code samples, can all be `Fix`

## Criteria

### Naming of members (Classes, functions, constants, parameters, etc.)

- Members should be named in a simple and consistent way
- Member names should avoid terms that are spelled differently in British and American English

### Completeness

- For each capability described in the design intent, is there a clear API path to accomplish it?
- Are there use cases implied by the design intent that require awkward workarounds or are impossible with the current API?

### Public vs private

Do we export the right members? You can determine if a member is exported because it will have a doc comment - `/** ... */` - our lint rules require them, and ban them on non-exported members. Some exported members that we don't want to document are documented `/** */` solely to mark them as exported.

- Have we exported the members necessary to access the public API?
- Have we exported the key supporting types? This is a judgement call. We don't export every methods, parameter, and return types, only if they are likely to be useful in client code when constructing values to pass to the API.

### Unnecessary surface area

- Does the API expose capabilities that aren't motivated by anything in the design intent? If so, are they justified or are they speculative/premature?
- Are there multiple ways to accomplish the same outcome without a clear reason for the duplication?

### Abstraction level

- Is the API pitched at the right level of abstraction for its intended consumers? (Too low-level forces boilerplate; too high-level prevents legitimate use cases.)
- Does the API leak implementation details that consumers shouldn't need to care about?

### Consistency and predictability

- Do similar operations follow similar patterns in naming, parameter shape, and return types?
- Are concepts named consistently between the design intent document and the actual API?

### Composability

- Can the API's primitives be combined to handle edge cases not explicitly listed in the design intent?
- Does the API integrate naturally with the other modules it's expected to work alongside?

### Discoverability

- Given a task from the design intent, can a consumer find the right entry point without deep knowledge of internals?
- Is the "happy path" for common operations straightforward?

### Error semantics

- Are failure modes meaningful from the consumer's perspective, or do they expose internal implementation failures?
- Does the design intent describe expected failure scenarios, and does the API handle them?

### TypeScript type design

- Are TypeScript features used effectively to make the API easier to use correctly and harder to misuse? (e.g. union types, branded types, overloads, generics where they add value)
- Are there instances where unnecessary TypeScript complexity (e.g. deeply nested conditional types, excessive generics) makes the API harder to understand or use?

### Factory functions vs Constructor Classes

- our general policy is to provide factory functions for anything that needs to be instantiated where the factory function returns an instance. Occasionally concrete classes may be exported, but these tend to be in situations where the class is used as a value. For example, providing a middleware class that extended by user code, or passed around as a value rather than instantiated.

### Documentation comments

- Are the API's public members well-documented, with clear explanations of what they do and why?
- Do documentation comments cover error a dn event semantics where appropriate?
- Do documentation comments contain code samples where appropriate to aid understanding?
- Do any documentation comments contain excessive text or code samples? LLMs often go overboard and write more documentation text or code samples than necessary to give any reasonable human or machine the information they need. Assume that the reader can fill in obvious gaps themselves.
- Do documentation comments have high signal-noise ratio?
- Are we exclusively using British english in comments (we should be)