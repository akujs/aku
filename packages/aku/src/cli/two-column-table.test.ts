import { describe, expect, test } from "bun:test";
import { twoColumnTable } from "./two-column-table.ts";

describe(twoColumnTable, () => {
	test("aligns columns based on longest label", () => {
		const result = twoColumnTable({
			rows: [
				["a", "First"],
				["abc", "Second"],
			],
			width: 40,
		});

		expect(result).toMatchInlineSnapshot(`
"a    First
abc  Second
"
`);
	});

	test("handles empty rows array", () => {
		const result = twoColumnTable({
			rows: [],
			width: 40,
		});

		expect(result).toBe("");
	});

	test("strips ANSI codes from left column before processing", () => {
		// Input has ANSI bold codes that should be stripped
		const result = twoColumnTable({
			rows: [["\x1b[1mBold\x1b[0m", "Description"]],
			width: 40,
		});

		expect(result).toMatchInlineSnapshot(`
"Bold  Description
"
`);
	});

	test("truncates long labels with ellipsis", () => {
		const result = twoColumnTable({
			rows: [["very-long-label-name", "Description"]],
			width: 30,
		});

		// Max left width is floor((30 - 0 - 2) / 2) = 14
		// So "very-long-label-name" (20 chars) truncates to "very-long-l..." (14 chars)
		expect(result).toMatchInlineSnapshot(`
"very-long-l...  Description
"
`);
	});

	test("wraps long descriptions and indents continuation lines", () => {
		const result = twoColumnTable({
			rows: [["key", "This is a very long description that should wrap to multiple lines"]],
			width: 40,
		});

		expect(result).toMatchInlineSnapshot(`
"key  This is a very long description
     that should wrap to multiple lines
"
`);
	});

	test("applies colour to left column", () => {
		const result = twoColumnTable({
			rows: [["label", "value"]],
			width: 40,
			leftColor: "blue",
		});

		// Blue ANSI: \x1b[34m ... \x1b[39m
		expect(result).toMatchInlineSnapshot(`
"\x1B[34mlabel\x1B[39m  value
"
`);
	});

	test("applies indent to all lines", () => {
		const result = twoColumnTable({
			rows: [["key", "A long value that will wrap onto another line"]],
			width: 40,
			indent: "  ",
		});

		expect(result).toMatchInlineSnapshot(`
"  key  A long value that will wrap onto
       another line
"
`);
	});

	test("handles multiple rows with varying lengths", () => {
		const result = twoColumnTable({
			rows: [
				["short", "First item"],
				["medium-len", "Second item"],
				["x", "Third item"],
			],
			width: 40,
		});

		expect(result).toMatchInlineSnapshot(`
"short       First item
medium-len  Second item
x           Third item
"
`);
	});

	test("handles rows with empty strings", () => {
		const result = twoColumnTable({
			rows: [
				["label", ""],
				["", "value"],
			],
			width: 40,
		});

		expect(result).toMatchInlineSnapshot(`
"label  
       value
"
`);
	});
});
