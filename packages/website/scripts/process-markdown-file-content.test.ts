import { expect, test } from "bun:test";
import { processMarkdownFileContentFromString } from "./code-block-utils.ts";

test("preserves content when all blocks are manual", () => {
	const content = `# Test Document

Some text here.

<!-- source: manual -->
\`\`\`ts
const x = 1;
console.log(x);
\`\`\`

More text.

<!-- source: manual -->
\`\`\`js
function hello() {
  return "world";
}
\`\`\`
`;

	const result = processMarkdownFileContentFromString(content, "");
	expect(result).toBe(content);
});

test("updates code block from test source", () => {
	const testContent = `
import { test, expect } from "bun:test";

test("sample test", () => {
  // BEGIN
  const result = 1 + 1;
  expect(result).toBe(2);
  // END
});

test("another test", () => {
  // BEGIN
  const name = "world";
  console.log(\`Hello, \${name}!\`);
  // END
});
`;

	const markdownContent = `# Test Document

Here's some code:

<!-- source: sample test -->
\`\`\`ts
// old code that should be replaced
\`\`\`

And another:

<!-- source: another test -->
\`\`\`js
// this should also be replaced
\`\`\`
`;

	const expected = `# Test Document

Here's some code:

<!-- source: sample test -->
\`\`\`ts
const result = 1 + 1;
expect(result).toBe(2);
\`\`\`

And another:

<!-- source: another test -->
\`\`\`js
const name = "world";
console.log(\`Hello, \${name}!\`);
\`\`\`
`;

	const result = processMarkdownFileContentFromString(markdownContent, testContent);
	expect(result).toBe(expected);
});

test("handles multiple code blocks", () => {
	const testContent = `
import { test } from "bun:test";

test("automated block", () => {
  // BEGIN
  return "This is automated";
  // END
});
`;

	const markdownContent = `# Mixed Content

<!-- source: manual -->
\`\`\`ts
// This stays as is
const manual = true;
\`\`\`

<!-- source: automated block -->
\`\`\`ts
// This gets replaced
\`\`\`

<!-- source: manual -->
\`\`\`js
// Another manual block
\`\`\`
`;

	const expected = `# Mixed Content

<!-- source: manual -->
\`\`\`ts
// This stays as is
const manual = true;
\`\`\`

<!-- source: automated block -->
\`\`\`ts
return "This is automated";
\`\`\`

<!-- source: manual -->
\`\`\`js
// Another manual block
\`\`\`
`;

	const result = processMarkdownFileContentFromString(markdownContent, testContent);
	expect(result).toBe(expected);
});

test("handles duplicate code blocks", () => {
	const testContent = `
import { test } from "bun:test";

test("automated block", () => {
  // BEGIN
  // new content
  // END
});
`;

	const markdownContent = `# Mixed Content

<!-- source: automated block -->
\`\`\`ts
// This gets replaced
\`\`\`

<!-- source: automated block -->
\`\`\`ts
// This gets replaced
\`\`\`
`;

	const expected = `# Mixed Content

<!-- source: automated block -->
\`\`\`ts
// new content
\`\`\`

<!-- source: automated block -->
\`\`\`ts
// new content
\`\`\`
`;

	const result = processMarkdownFileContentFromString(markdownContent, testContent);
	expect(result).toBe(expected);
});

test("preserves non-code content exactly", () => {
	const testContent = `
test("code sample", () => {
  // BEGIN
  const x = 42;
  // END
});
`;

	const markdownContent = `# Heading 1

This is a paragraph with **bold** and *italic* text.

## Heading 2

- List item 1
- List item 2
  - Nested item

> A blockquote

![An image](image.png)

[A link](https://example.com)

<!-- source: code sample -->
\`\`\`ts
// old
\`\`\`

### Heading 3

More text after the code block.

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
`;

	const result = processMarkdownFileContentFromString(markdownContent, testContent);

	// Check that all non-code content is preserved
	expect(result).toContain("# Heading 1");
	expect(result).toContain("This is a paragraph with **bold** and *italic* text.");
	expect(result).toContain("- List item 1");
	expect(result).toContain("> A blockquote");
	expect(result).toContain("![An image](image.png)");
	expect(result).toContain("[A link](https://example.com)");
	expect(result).toContain("| Column 1 | Column 2 |");

	// Check that code was updated
	expect(result).toContain("const x = 42;");
	expect(result).not.toContain("// old");
});

test("handles missing test gracefully", () => {
	const testContent = `
test("existing test", () => {
  // BEGIN
  return true;
  // END
});
`;

	const markdownContent = `# Test

<!-- source: non-existent test -->
\`\`\`ts
code here
\`\`\`
`;

	expect(() => {
		processMarkdownFileContentFromString(markdownContent, testContent);
	}).toThrow('Test "non-existent test" not found');
});

test("preserves code block language specifier", () => {
	const testContent = `
test("sample code", () => {
  // BEGIN
  const code = "example";
  // END
});
`;

	const markdownContent = `# Languages

<!-- source: sample code -->
\`\`\`typescript
old
\`\`\`

<!-- source: sample code -->
\`\`\`javascript
old
\`\`\`

<!-- source: sample code -->
\`\`\`tsx
old
\`\`\`

<!-- source: sample code -->
\`\`\`jsx
old
\`\`\`
`;

	const result = processMarkdownFileContentFromString(markdownContent, testContent);

	expect(result).toContain("\`\`\`typescript");
	expect(result).toContain("\`\`\`javascript");
	expect(result).toContain("\`\`\`tsx");
	expect(result).toContain("\`\`\`jsx");

	// All should have the same content
	const codeCount = (result.match(/const code = "example";/g) || []).length;
	expect(codeCount).toBe(4);
});

test("handles code blocks without source comments", () => {
	const markdownContent = `# Test

\`\`\`ts
// This has no source comment
const x = 1;
\`\`\`
`;

	// Should not throw, just leave unchanged
	const result = processMarkdownFileContentFromString(markdownContent, "");
	expect(result).toBe(markdownContent);
});

test("throws error when test is missing BEGIN/END markers", () => {
	const testContent = `
test("test without markers", () => {
  const x = 1;
  return x;
});
`;

	const markdownContent = `# Test

<!-- source: test without markers -->
\`\`\`ts
code
\`\`\`
`;

	expect(() => {
		processMarkdownFileContentFromString(markdownContent, testContent);
	}).toThrow("missing BEGIN/END markers");
});

test("generates aku imports automatically", () => {
	const testContent = `
import { test } from "bun:test";
import { Container, inject } from "@akujs/aku";

test("use aku", () => {
  // BEGIN
  console.log(Container);
  // END
});
`;

	const markdownContent = `# Test

<!-- source: use aku -->
\`\`\`ts
old code
\`\`\`
`;

	const expected = `# Test

<!-- source: use aku -->
\`\`\`ts
import { Container } from "@akujs/aku";

console.log(Container);
\`\`\`
`;

	const result = processMarkdownFileContentFromString(markdownContent, testContent);
	expect(result).toBe(expected);
});

test("skips aku imports with no-imports token", () => {
	const testContent = `
import { test } from "bun:test";
import { Container, inject } from "@akujs/aku";

test("use aku", () => {
  // BEGIN
  console.log(Container);
  console.log(inject);
  // END
});
`;

	const markdownContent = `# Test

<!-- source: use aku; no-imports -->
\`\`\`ts
old code
\`\`\`
`;

	const expected = `# Test

<!-- source: use aku; no-imports -->
\`\`\`ts
console.log(Container);
console.log(inject);
\`\`\`
`;

	const result = processMarkdownFileContentFromString(markdownContent, testContent);
	expect(result).toBe(expected);
});

test("throws error on invalid token", () => {
	const testContent = `
test("test", () => {
  // BEGIN
  console.log("test");
  // END
});
`;

	const markdownContent = `# Test

<!-- source: test; invalid-token -->
\`\`\`ts
code
\`\`\`
`;

	expect(() => {
		processMarkdownFileContentFromString(markdownContent, testContent);
	}).toThrow('Invalid token in source comment: "invalid-token"');
});

test("handles complex test with async and multiple statements", () => {
	const testContent = `
import { test } from "bun:test";

test("complex async test", async () => {
  // BEGIN
  const data = await fetch("/api/data");
  const json = await data.json();
  
  expect(json).toHaveProperty("status");
  expect(json.status).toBe("ok");
  
  // Process the data
  const processed = json.items.map(item => ({
    ...item,
    timestamp: Date.now()
  }));
  
  return processed;
  // END
});
`;

	const markdownContent = `# Test

<!-- source: complex async test -->
\`\`\`ts
// old code
\`\`\`
`;

	const result = processMarkdownFileContentFromString(markdownContent, testContent);

	// Should contain all the test content properly formatted
	expect(result).toContain("const data = await fetch");
	expect(result).toContain('expect(json.status).toBe("ok");');
	expect(result).toContain("timestamp: Date.now()");
	expect(result).toContain("return processed;");
});
