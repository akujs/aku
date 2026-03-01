import { describe, expect, test } from "bun:test";
import type { ArgumentDefinition } from "./cli-types.ts";
import { formatArgumentDetail, formatUsageToken } from "./formatArgument.ts";

describe(formatUsageToken, () => {
	test.each([
		// # | name    | def                                                                      | usage token             | detail label         | detail metadata
		// Positional string
		[1, "file", { type: "string", positional: true, required: true } as const, "<file>", "<file>", "required"],
		[2, "file", { type: "string", positional: true } as const, "[file]", "[file]", "optional"],
		[3, "file", { type: "string", positional: true, default: "foo" } as const, "[file]", "[file]", 'optional, default: "foo"'],
		// Positional number
		[4, "count", { type: "number", positional: true, required: true } as const, "<count>", "<count>", "number, required"],
		[5, "count", { type: "number", positional: true } as const, "[count]", "[count]", "number, optional"],
		[6, "count", { type: "number", positional: true, default: 8080 } as const, "[count]", "[count]", "number, optional, default: 8080"],
		// Positional string array
		[7, "file", { type: "string", positional: true, array: true, required: true } as const, "<file> [file...]", "<file>", "required, repeatable"],
		[8, "file", { type: "string", positional: true, array: true } as const, "[file...]", "[file]", "optional, repeatable"],
		[9, "file", { type: "string", positional: true, array: true, default: ["a", "b"] } as const, "[file...]", "[file]", 'optional, default: "a", "b", repeatable'],
		// Positional number array
		[10, "count", { type: "number", positional: true, array: true, required: true } as const, "<count> [count...]", "<count>", "number, required, repeatable"],
		[11, "count", { type: "number", positional: true, array: true } as const, "[count...]", "[count]", "number, optional, repeatable"],
		[12, "count", { type: "number", positional: true, array: true, default: [1, 2] } as const, "[count...]", "[count]", "number, optional, default: 1, 2, repeatable"],
		// Named string
		[13, "file", { type: "string", required: true } as const, "--file=<value>", "--file=<value>", "required"],
		[14, "file", { type: "string" } as const, null, "--file=<value>", "optional"],
		[15, "file", { type: "string", default: "foo" } as const, null, "--file=<value>", 'optional, default: "foo"'],
		// Named number
		[16, "count", { type: "number", required: true } as const, "--count=<value>", "--count=<value>", "number, required"],
		[17, "count", { type: "number" } as const, null, "--count=<value>", "number, optional"],
		[18, "count", { type: "number", default: 8080 } as const, null, "--count=<value>", "number, optional, default: 8080"],
		// Named string array
		[19, "file", { type: "string", array: true, required: true } as const, "--file=<value>", "--file=<value>", "required, repeatable"],
		[20, "file", { type: "string", array: true } as const, null, "--file=<value>", "optional, repeatable"],
		[21, "file", { type: "string", array: true, default: ["a", "b"] } as const, null, "--file=<value>", 'optional, default: "a", "b", repeatable'],
		// Named number array
		[22, "count", { type: "number", array: true, required: true } as const, "--count=<value>", "--count=<value>", "number, required, repeatable"],
		[23, "count", { type: "number", array: true } as const, null, "--count=<value>", "number, optional, repeatable"],
		[24, "count", { type: "number", array: true, default: [1, 2] } as const, null, "--count=<value>", "number, optional, default: 1, 2, repeatable"],
		// Named boolean
		[25, "verbose", { type: "boolean" } as const, null, "--verbose", "optional"],
	] satisfies [number, string, ArgumentDefinition, string | null, string, string][])(
		"case %i: %s",
		(_caseNum, name, def, expectedUsageToken, expectedDetailLabel, expectedDetailMetadata) => {
			expect(formatUsageToken(name, def)).toBe(expectedUsageToken);

			const detail = formatArgumentDetail(name, def);
			expect(detail.label).toBe(expectedDetailLabel);
			expect(detail.description).toContain(`(${expectedDetailMetadata})`);
		},
	);

	test("kebab-case conversion for camelCase named args", () => {
		const def = { type: "string", required: true } as const satisfies ArgumentDefinition;
		expect(formatUsageToken("outputDir", def)).toBe("--output-dir=<value>");

		const detail = formatArgumentDetail("outputDir", def);
		expect(detail.label).toBe("--output-dir=<value>");
	});

	test("description is included before metadata", () => {
		const def = {
			type: "string",
			positional: true,
			required: true,
			description: "The file to process",
		} as const satisfies ArgumentDefinition;

		const detail = formatArgumentDetail("file", def);
		expect(detail.description).toBe("The file to process (required)");
	});

	test("no description shows only metadata", () => {
		const def = {
			type: "string",
			positional: true,
			required: true,
		} as const satisfies ArgumentDefinition;

		const detail = formatArgumentDetail("file", def);
		expect(detail.description).toBe("(required)");
	});
});
