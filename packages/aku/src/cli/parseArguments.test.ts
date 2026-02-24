import { describe, expect, expectTypeOf, test } from "bun:test";
import type { ArgumentSchema } from "./cli-types.ts";
import { parseArguments } from "./parseArguments.ts";

describe(parseArguments, () => {
	describe("systematic argument combinations", () => {
		// Type-safe 32-case matrix covering all combinations of:
		// - Position: named | positional
		// - Type: String | Boolean
		// - Cardinality: (single) | Array
		// - Requirement: Optional | Required
		// - Default: (none) | Default
		// Boolean arrays (8 cases) throw schema validation errors.

		type Position = "named" | "positional";
		type ValueType = "String" | "Boolean";
		type Cardinality = "" | "Array";
		type Requirement = "Optional" | "Required";
		type DefaultType = "" | "Default";

		type TestKey = `${Position}${ValueType}${Cardinality}${Requirement}${DefaultType}`;

		const testCases: Record<TestKey, () => void> = {
			// Named - String
			namedStringOptional() {
				const arg = { type: "string" } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg?: string }>();
				expect(parseArguments([], { arg })).toEqual({});
				expect(parseArguments(["--arg", "val"], { arg })).toEqual({ arg: "val" });
			},
			namedStringOptionalDefault() {
				const arg = { type: "string", default: "def" } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string }>();
				expect(parseArguments([], { arg })).toEqual({ arg: "def" });
				expect(parseArguments(["--arg", "val"], { arg })).toEqual({ arg: "val" });
			},
			namedStringRequired() {
				const arg = { type: "string", required: true } as const;
				const result = parseArguments(["--arg", "val"], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string }>();
				expect(() => parseArguments([], { arg })).toThrow("Missing required option: --arg");
				expect(parseArguments(["--arg", "val"], { arg })).toEqual({ arg: "val" });
			},
			namedStringRequiredDefault() {
				// required is ignored when a default is present
				testCases.namedStringOptionalDefault();
			},
			namedStringArrayOptional() {
				const arg = { type: "string", array: true } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string[] }>();
				expect(parseArguments([], { arg })).toEqual({ arg: [] });
				expect(parseArguments(["--arg", "a", "--arg", "b"], { arg })).toEqual({ arg: ["a", "b"] });
			},
			namedStringArrayOptionalDefault() {
				const arg = { type: "string", array: true, default: ["x", "y"] } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string[] }>();
				expect(parseArguments([], { arg })).toEqual({ arg: ["x", "y"] });
				expect(parseArguments(["--arg", "a"], { arg })).toEqual({ arg: ["a"] });
			},
			namedStringArrayRequired() {
				const arg = { type: "string", array: true, required: true } as const;
				const result = parseArguments(["--arg", "a"], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string[] }>();
				expect(() => parseArguments([], { arg })).toThrow("Missing required option: --arg");
				expect(parseArguments(["--arg", "a", "--arg", "b"], { arg })).toEqual({ arg: ["a", "b"] });
			},
			namedStringArrayRequiredDefault() {
				// required is ignored when a default is present
				testCases.namedStringArrayOptionalDefault();
			},

			// Named - Boolean
			namedBooleanOptional() {
				const arg = { type: "boolean" } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: boolean }>();
				expect(parseArguments([], { arg })).toEqual({ arg: false });
				expect(parseArguments(["--arg"], { arg })).toEqual({ arg: true });
			},
			namedBooleanOptionalDefault() {
				const arg = { type: "boolean", default: true } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: boolean }>();
				expect(parseArguments([], { arg })).toEqual({ arg: true });
				expect(parseArguments(["--arg=false"], { arg })).toEqual({ arg: false });
			},
			namedBooleanRequired() {
				// required is ignored for booleans as they always have a default value
				testCases.namedBooleanOptional();
			},
			namedBooleanRequiredDefault() {
				// required is ignored when a default is present
				testCases.namedBooleanOptionalDefault();
			},
			namedBooleanArrayOptional() {
				const arg = { type: "boolean", array: true } as const;
				// @ts-expect-error boolean arrays are invalid at type level
				expect(() => parseArguments([], { arg })).toThrow(
					"boolean array arguments are not supported",
				);
			},
			namedBooleanArrayOptionalDefault() {
				const arg = { type: "boolean", array: true, default: [true] } as const;
				// @ts-expect-error boolean arrays are invalid at type level
				expect(() => parseArguments([], { arg })).toThrow(
					"boolean array arguments are not supported",
				);
			},
			namedBooleanArrayRequired() {
				// required is ignored for booleans as they always have a default value
				testCases.namedBooleanArrayOptional();
			},
			namedBooleanArrayRequiredDefault() {
				// required is ignored when a default is present
				testCases.namedBooleanArrayOptionalDefault();
			},

			// Positional - String
			positionalStringOptional() {
				const arg = { type: "string", positional: true } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg?: string }>();
				expect(parseArguments([], { arg })).toEqual({});
				expect(parseArguments(["val"], { arg })).toEqual({ arg: "val" });
			},
			positionalStringOptionalDefault() {
				const arg = { type: "string", positional: true, default: "def" } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string }>();
				expect(parseArguments([], { arg })).toEqual({ arg: "def" });
				expect(parseArguments(["val"], { arg })).toEqual({ arg: "val" });
			},
			positionalStringRequired() {
				const arg = { type: "string", positional: true, required: true } as const;
				const result = parseArguments(["val"], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string }>();
				expect(() => parseArguments([], { arg })).toThrow("Missing required argument: arg");
				expect(parseArguments(["val"], { arg })).toEqual({ arg: "val" });
			},
			positionalStringRequiredDefault() {
				// required is ignored when a default is present
				testCases.positionalStringOptionalDefault();
			},
			positionalStringArrayOptional() {
				const arg = { type: "string", positional: true, array: true } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string[] }>();
				expect(parseArguments([], { arg })).toEqual({ arg: [] });
				expect(parseArguments(["a", "b", "c"], { arg })).toEqual({ arg: ["a", "b", "c"] });
			},
			positionalStringArrayOptionalDefault() {
				const arg = { type: "string", positional: true, array: true, default: ["x", "y"] } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string[] }>();
				expect(parseArguments([], { arg })).toEqual({ arg: ["x", "y"] });
				expect(parseArguments(["a"], { arg })).toEqual({ arg: ["a"] });
			},
			positionalStringArrayRequired() {
				const arg = { type: "string", positional: true, array: true, required: true } as const;
				const result = parseArguments(["a"], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: string[] }>();
				expect(() => parseArguments([], { arg })).toThrow("Missing required argument: arg");
				expect(parseArguments(["a", "b"], { arg })).toEqual({ arg: ["a", "b"] });
			},
			positionalStringArrayRequiredDefault() {
				// required is ignored when a default is present
				testCases.positionalStringArrayOptionalDefault();
			},

			// Positional - Boolean
			positionalBooleanOptional() {
				const arg = { type: "boolean", positional: true } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: boolean }>();
				expect(parseArguments([], { arg })).toEqual({ arg: false });
				expect(parseArguments(["true"], { arg })).toEqual({ arg: true });
			},
			positionalBooleanOptionalDefault() {
				const arg = { type: "boolean", positional: true, default: true } as const;
				const result = parseArguments([], { arg });
				expectTypeOf(result).toEqualTypeOf<{ arg: boolean }>();
				expect(parseArguments([], { arg })).toEqual({ arg: true });
				expect(parseArguments(["false"], { arg })).toEqual({ arg: false });
			},
			positionalBooleanRequired() {
				// required is ignored for booleans as they always have a default value
				testCases.positionalBooleanOptional();
			},
			positionalBooleanRequiredDefault() {
				// required is ignored when a default is present
				testCases.positionalBooleanOptionalDefault();
			},
			positionalBooleanArrayOptional() {
				const arg = { type: "boolean", positional: true, array: true } as const;
				// @ts-expect-error boolean arrays are invalid at type level
				expect(() => parseArguments([], { arg })).toThrow(
					"boolean array arguments are not supported",
				);
			},
			positionalBooleanArrayOptionalDefault() {
				const arg = { type: "boolean", positional: true, array: true } as const;
				// @ts-expect-error boolean arrays are invalid at type level
				expect(() => parseArguments([], { arg })).toThrow(
					"boolean array arguments are not supported",
				);
			},
			positionalBooleanArrayRequired() {
				// required is ignored for booleans as they always have a default value
				testCases.positionalBooleanArrayOptional();
			},
			positionalBooleanArrayRequiredDefault() {
				// required is ignored when a default is present
				testCases.positionalBooleanArrayOptionalDefault();
			},
		};

		test.each(Object.entries(testCases))("%s", (_, fn) => fn());
	});

	// Reusable argument definitions at top level
	const requiredStringPositional = { type: "string", positional: true, required: true } as const;
	const optionalStringPositional = { type: "string", positional: true } as const;
	const requiredNumberPositional = { type: "number", positional: true, required: true } as const;
	const requiredBooleanPositional = { type: "boolean", positional: true, required: true } as const;
	const requiredStringArrayPositional = {
		type: "string",
		positional: true,
		array: true,
		required: true,
	} as const;
	const optionalBoolean = { type: "boolean" } as const;
	const optionalString = { type: "string" } as const;
	const optionalNumber = { type: "number" } as const;
	const optionalNumberArray = { type: "number", array: true } as const;

	describe("multi-argument schemas", () => {
		test("parses multiple positionals in order", () => {
			const result = parseArguments(["a.txt", "b.txt"], {
				source: requiredStringPositional,
				dest: optionalStringPositional,
			});
			expect(result).toEqual({ source: "a.txt", dest: "b.txt" });
		});

		test("handles mixed positional and named arguments", () => {
			const result = parseArguments(["input.txt", "--verbose", "--output", "output.txt"], {
				file: requiredStringPositional,
				verbose: { type: "boolean" },
				output: { type: "string" },
			});
			expect(result).toEqual({ file: "input.txt", verbose: true, output: "output.txt" });
		});

		test("parses mixed positional with variadic last", () => {
			const result = parseArguments(["src.txt", "a.txt", "b.txt"], {
				source: requiredStringPositional,
				targets: requiredStringArrayPositional,
			});
			expect(result).toEqual({ source: "src.txt", targets: ["a.txt", "b.txt"] });
		});

		test("supports array positional after non-array positional", () => {
			const result = parseArguments(["a", "b", "c"], {
				action: requiredStringPositional,
				files: requiredStringArrayPositional,
			});
			expect(result).toEqual({ action: "a", files: ["b", "c"] });
		});

		test("infers combined positional and named", () => {
			const result = parseArguments(["src"], {
				source: { type: "string", positional: true, required: true },
				dest: { type: "string", positional: true },
				force: { type: "boolean" },
				count: { type: "number" },
			} as const satisfies ArgumentSchema);

			expectTypeOf(result).toEqualTypeOf<{
				source: string;
				dest?: string;
				force: boolean;
				count?: number;
			}>();
		});
	});

	describe("validation errors", () => {
		test("throws for excess positional arguments", () => {
			expect(() => parseArguments(["foo", "bar"], { file: requiredStringPositional })).toThrow(
				'Unexpected 2nd positional argument "bar"',
			);
		});

		test("throws for excess positional with special characters", () => {
			expect(() =>
				parseArguments(["foo", 'bar "baz"'], { file: requiredStringPositional }),
			).toThrow('Unexpected 2nd positional argument "bar \\"baz\\""');
		});

		test("throws for excess positional with no schema", () => {
			expect(() => parseArguments(["foo"], {})).toThrow('Unexpected 1st positional argument "foo"');
		});

		test("throws for unknown named argument", () => {
			expect(() => parseArguments(["--unknown"], { known: optionalBoolean })).toThrow(
				"Unknown option: --unknown",
			);
		});

		test("throws for string option without value", () => {
			expect(() => parseArguments(["--output"], { output: optionalString })).toThrow(
				"Option '--output' requires a value",
			);
		});

		test("throws for number option without value", () => {
			expect(() => parseArguments(["--port"], { port: optionalNumber })).toThrow(
				"Option '--port' requires a value",
			);
		});
	});

	describe("number arguments", () => {
		test("parses number positional and converts to number", () => {
			const result = parseArguments(["42"], { count: requiredNumberPositional });
			expect(result).toEqual({ count: 42 });
		});

		test("parses floating point numbers", () => {
			const result = parseArguments(["3.14"], { rate: requiredNumberPositional });
			expect(result).toEqual({ rate: 3.14 });
		});

		test("parses number option and converts to number", () => {
			const result = parseArguments(["--port", "8080"], { port: optionalNumber });
			expect(result).toEqual({ port: 8080 });
		});

		test("parses number array named", () => {
			const result = parseArguments(["--ids", "1", "--ids", "2", "--ids", "3"], {
				ids: optionalNumberArray,
			});
			expect(result).toEqual({ ids: [1, 2, 3] });
		});

		test("throws for invalid number format (positional)", () => {
			expect(() => parseArguments(["abc"], { count: requiredNumberPositional })).toThrow(
				'Invalid number: "abc"',
			);
		});

		test("throws for invalid number format (named)", () => {
			expect(() => parseArguments(["--port", "abc"], { port: optionalNumber })).toThrow(
				'Invalid number: "abc"',
			);
		});

		test("infers required number named", () => {
			const result = parseArguments(["--count", "1"], {
				count: { type: "number", required: true },
			} as const satisfies ArgumentSchema);

			expectTypeOf(result).toEqualTypeOf<{ count: number }>();
		});

		test("infers optional number positional", () => {
			const result = parseArguments([], {
				count: { type: "number", positional: true },
			} as const satisfies ArgumentSchema);

			expectTypeOf(result).toEqualTypeOf<{ count?: number }>();
		});

		test("infers required number positional", () => {
			const result = parseArguments(["42"], {
				count: { type: "number", positional: true, required: true },
			} as const satisfies ArgumentSchema);

			expectTypeOf(result).toEqualTypeOf<{ count: number }>();
		});
	});

	describe("boolean parsing", () => {
		test('parses "true" string as true', () => {
			const result = parseArguments(["true"], { flag: requiredBooleanPositional });
			expect(result).toEqual({ flag: true });
		});

		test('parses "false" string as false', () => {
			const result = parseArguments(["false"], { flag: requiredBooleanPositional });
			expect(result).toEqual({ flag: false });
		});

		test('parses "yes" string as true', () => {
			const result = parseArguments(["yes"], { flag: requiredBooleanPositional });
			expect(result).toEqual({ flag: true });
		});

		test('parses "no" string as false', () => {
			const result = parseArguments(["no"], { flag: requiredBooleanPositional });
			expect(result).toEqual({ flag: false });
		});

		test('parses "y" string as true', () => {
			const result = parseArguments(["y"], { flag: requiredBooleanPositional });
			expect(result).toEqual({ flag: true });
		});

		test('parses "n" string as false', () => {
			const result = parseArguments(["n"], { flag: requiredBooleanPositional });
			expect(result).toEqual({ flag: false });
		});

		test('parses "1" string as true', () => {
			const result = parseArguments(["1"], { flag: requiredBooleanPositional });
			expect(result).toEqual({ flag: true });
		});

		test('parses "0" string as false', () => {
			const result = parseArguments(["0"], { flag: requiredBooleanPositional });
			expect(result).toEqual({ flag: false });
		});

		test("parses case insensitively", () => {
			expect(parseArguments(["TRUE"], { flag: requiredBooleanPositional })).toEqual({
				flag: true,
			});
			expect(parseArguments(["FALSE"], { flag: requiredBooleanPositional })).toEqual({
				flag: false,
			});
			expect(parseArguments(["Yes"], { flag: requiredBooleanPositional })).toEqual({
				flag: true,
			});
			expect(parseArguments(["No"], { flag: requiredBooleanPositional })).toEqual({
				flag: false,
			});
			expect(parseArguments(["Y"], { flag: requiredBooleanPositional })).toEqual({
				flag: true,
			});
			expect(parseArguments(["N"], { flag: requiredBooleanPositional })).toEqual({
				flag: false,
			});
		});

		test("parses --flag=false as false", () => {
			const result = parseArguments(["--verbose=false"], { verbose: optionalBoolean });
			expect(result).toEqual({ verbose: false });
		});

		test("overrides default true with --flag=false", () => {
			const schema = { verbose: { type: "boolean", default: true } } as const;
			expect(parseArguments([], schema)).toEqual({ verbose: true });
			expect(parseArguments(["--verbose=false"], schema)).toEqual({ verbose: false });
		});

		test("throws for invalid boolean string", () => {
			expect(() => parseArguments(["maybe"], { flag: requiredBooleanPositional })).toThrow(
				'Invalid boolean: "maybe". Use true/false, yes/no, y/n, or 0/1.',
			);
		});
	});

	describe("schema validation", () => {
		test("throws for array on non-last positional", () => {
			expect(() =>
				parseArguments([], {
					files: { type: "string", positional: true, array: true },
					extra: optionalStringPositional,
				}),
			).toThrow("array positional argument (files) must be the last positional argument");
		});

		test("throws for mixing array and optional positionals", () => {
			expect(() =>
				parseArguments([], {
					optional: optionalStringPositional,
					files: { type: "string", positional: true, array: true },
				}),
			).toThrow("can't mix array positional arguments (files) and optional (optional)");
		});

		test("throws for required positional after optional", () => {
			expect(() =>
				parseArguments([], {
					optional: optionalStringPositional,
					required: requiredStringPositional,
				}),
			).toThrow(
				'required positional argument "required" cannot follow optional positional argument "optional"',
			);
		});
	});

	describe("number defaults", () => {
		test("uses default for missing named number", () => {
			const result = parseArguments([], { port: { type: "number", default: 8080 } });
			expect(result).toEqual({ port: 8080 });
		});

		test("provided value overrides default", () => {
			const result = parseArguments(["--port", "3000"], {
				port: { type: "number", default: 8080 },
			});
			expect(result).toEqual({ port: 3000 });
		});

		test("infers non-optional type when named has default", () => {
			const result = parseArguments([], {
				port: { type: "number", default: 8080 },
			} as const satisfies ArgumentSchema);

			expectTypeOf(result).toEqualTypeOf<{ port: number }>();
		});
	});

	describe("schema edge cases", () => {
		test("returns empty object for undefined schema with no args", () => {
			const result = parseArguments([], undefined);
			expect(result).toEqual({});
		});

		test("returns empty object for empty schema", () => {
			const result = parseArguments([], {});
			expect(result).toEqual({});
		});

		test("throws for positional with undefined schema", () => {
			expect(() => parseArguments(["foo"], undefined)).toThrow(
				'Unexpected 1st positional argument "foo"',
			);
		});

		test("throws for named arg with undefined schema", () => {
			expect(() => parseArguments(["--bar"], undefined)).toThrow("Unknown option: --bar");
		});

		test("infers empty schema as empty object", () => {
			const result = parseArguments([], {} as const satisfies ArgumentSchema);

			expectTypeOf(result).toEqualTypeOf<{}>();
		});
	});

	describe("kebab-case argument mapping", () => {
		test("maps --multi-word to multiWord schema key", () => {
			const result = parseArguments(["--multi-word", "value"], {
				multiWord: { type: "string" },
			});
			expect(result).toEqual({ multiWord: "value" });
		});

		test("maps --multi-word=value to multiWord schema key", () => {
			const result = parseArguments(["--multi-word=value"], {
				multiWord: { type: "string" },
			});
			expect(result).toEqual({ multiWord: "value" });
		});

		test("maps --dry-run boolean to dryRun schema key", () => {
			const result = parseArguments(["--dry-run"], {
				dryRun: { type: "boolean" },
			});
			expect(result).toEqual({ dryRun: true });
		});

		test("maps --dry-run=false to dryRun schema key", () => {
			const result = parseArguments(["--dry-run=false"], {
				dryRun: { type: "boolean" },
			});
			expect(result).toEqual({ dryRun: false });
		});

		test("maps multiple kebab-case arguments", () => {
			const result = parseArguments(
				["--input-file", "in.txt", "--output-dir", "out/", "--dry-run"],
				{
					inputFile: { type: "string" },
					outputDir: { type: "string" },
					dryRun: { type: "boolean" },
				},
			);
			expect(result).toEqual({ inputFile: "in.txt", outputDir: "out/", dryRun: true });
		});

		test("throws for missing required kebab-case option", () => {
			expect(() =>
				parseArguments([], {
					multiWord: { type: "string", required: true },
				}),
			).toThrow("Missing required option: --multi-word");
		});

		test("shows kebab-case name in 'requires a value' error", () => {
			expect(() =>
				parseArguments(["--multi-word"], {
					multiWord: { type: "string" },
				}),
			).toThrow("Option '--multi-word' requires a value");
		});
	});
});
