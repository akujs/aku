import { describe, expect, expectTypeOf, test } from "bun:test";
import type { ArgumentSchema } from "./cli-types.ts";
import { parseArguments } from "./parseArguments.ts";

describe(parseArguments, () => {
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
	const requiredString = { type: "string", required: true } as const;
	const optionalNumber = { type: "number" } as const;
	const optionalStringArray = { type: "string", array: true } as const;
	const optionalNumberArray = { type: "number", array: true } as const;

	describe("string arguments", () => {
		describe("positional", () => {
			test("accepts required string positional", () => {
				const result = parseArguments(["foo.txt"], { file: requiredStringPositional });
				expect(result).toEqual({ file: "foo.txt" });
			});

			test("errors when required string positional is missing", () => {
				expect(() =>
					parseArguments([], { file: requiredStringPositional }),
				).toThrowErrorMatchingInlineSnapshot(`"Missing required argument: file"`);
			});

			test("accepts optional string positional", () => {
				const result = parseArguments(["foo.txt"], { file: optionalStringPositional });
				expect(result).toEqual({ file: "foo.txt" });
			});

			test("does not create properties for missing optional positional", () => {
				const result = parseArguments([], { file: optionalStringPositional });
				expect(result).toEqual({});
			});

			test("parses multiple positionals in order", () => {
				const result = parseArguments(["a.txt", "b.txt"], {
					source: requiredStringPositional,
					dest: optionalStringPositional,
				});
				expect(result).toEqual({ source: "a.txt", dest: "b.txt" });
			});

			test("handles mixed positional and named arguments", () => {
				const result = parseArguments(["input.txt", "-v", "-o", "output.txt"], {
					file: requiredStringPositional,
					verbose: { type: "boolean", short: "v" },
					output: { type: "string", short: "o" },
				});
				expect(result).toEqual({ file: "input.txt", verbose: true, output: "output.txt" });
			});

			test("throws for missing required positional", () => {
				expect(() => parseArguments([], { file: requiredStringPositional })).toThrow(
					"Missing required argument: file",
				);
			});

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
				expect(() => parseArguments(["foo"], {})).toThrow(
					'Unexpected 1st positional argument "foo"',
				);
			});
		});

		describe("named", () => {
			test("parses string option with value", () => {
				const result = parseArguments(["--output", "file.txt"], { output: optionalString });
				expect(result).toEqual({ output: "file.txt" });
			});

			test("parses short alias for string option", () => {
				const result = parseArguments(["-o", "file.txt"], {
					output: { type: "string", short: "o" },
				});
				expect(result).toEqual({ output: "file.txt" });
			});

			test("throws for missing required named", () => {
				expect(() => parseArguments([], { output: requiredString })).toThrow(
					"Missing required option: --output",
				);
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

		describe("type inference", () => {
			test("infers required string positional", () => {
				const result = parseArguments(["test"], {
					file: { type: "string", positional: true, required: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ file: string }>();
			});

			test("infers optional string positional", () => {
				const result = parseArguments([], {
					file: { type: "string", positional: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ file?: string | undefined }>();
			});

			test("infers combined positional and named", () => {
				const result = parseArguments(["src"], {
					source: { type: "string", positional: true, required: true },
					dest: { type: "string", positional: true },
					force: { type: "boolean", short: "f" },
					count: { type: "number" },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{
					source: string;
					dest?: string | undefined;
					force: boolean;
					count?: number | undefined;
				}>();
			});

			test("infers required named string", () => {
				const result = parseArguments(["--output", "file.txt"], {
					output: { type: "string", required: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ output: string }>();
			});

			test("infers optional named string", () => {
				const result = parseArguments([], {
					output: { type: "string" },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ output?: string | undefined }>();
			});
		});
	});

	describe("number arguments", () => {
		describe("positional", () => {
			test("parses number positional and converts to number", () => {
				const result = parseArguments(["42"], { count: requiredNumberPositional });
				expect(result).toEqual({ count: 42 });
			});

			test("parses floating point numbers", () => {
				const result = parseArguments(["3.14"], { rate: requiredNumberPositional });
				expect(result).toEqual({ rate: 3.14 });
			});
		});

		describe("named", () => {
			test("parses number option and converts to number", () => {
				const result = parseArguments(["--port", "8080"], { port: optionalNumber });
				expect(result).toEqual({ port: 8080 });
			});
		});

		describe("validation errors", () => {
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
		});

		describe("type inference", () => {
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

				expectTypeOf(result).toEqualTypeOf<{ count?: number | undefined }>();
			});

			test("infers required number positional", () => {
				const result = parseArguments(["42"], {
					count: { type: "number", positional: true, required: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ count: number }>();
			});
		});
	});

	describe("boolean arguments", () => {
		describe("positional", () => {
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
			});
		});

		describe("named", () => {
			test("parses boolean flag as true when present", () => {
				const result = parseArguments(["--verbose"], { verbose: optionalBoolean });
				expect(result).toEqual({ verbose: true });
			});

			test("parses boolean flag as false when absent", () => {
				const result = parseArguments([], { verbose: optionalBoolean });
				expect(result).toEqual({ verbose: false });
			});

			test("parses short alias for boolean flag", () => {
				const result = parseArguments(["-f"], {
					force: { type: "boolean", short: "f" },
				});
				expect(result).toEqual({ force: true });
			});

			test("uses boolean default value", () => {
				const result = parseArguments([], {
					verbose: { type: "boolean", default: false },
				});
				expect(result).toEqual({ verbose: false });
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
		});

		describe("validation errors", () => {
			test("throws for invalid boolean string", () => {
				expect(() => parseArguments(["maybe"], { flag: requiredBooleanPositional })).toThrow(
					'Invalid boolean: "maybe". Use true/false, yes/no, or 0/1.',
				);
			});
		});

		describe("type inference", () => {
			test("infers optional boolean named as always present", () => {
				const result = parseArguments([], {
					verbose: { type: "boolean" },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ verbose: boolean }>();
			});

			test("infers required boolean positional", () => {
				const result = parseArguments(["true"], {
					flag: { type: "boolean", positional: true, required: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ flag: boolean }>();
			});

			test("infers optional boolean positional as always present", () => {
				const result = parseArguments([], {
					flag: { type: "boolean", positional: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ flag: boolean }>();
			});
		});
	});

	describe("array arguments", () => {
		describe("positional (variadic)", () => {
			test("parses variadic positional into array", () => {
				const result = parseArguments(["a.txt", "b.txt", "c.txt"], {
					files: requiredStringArrayPositional,
				});
				expect(result).toEqual({ files: ["a.txt", "b.txt", "c.txt"] });
			});

			test("parses mixed positional with variadic last", () => {
				const result = parseArguments(["src.txt", "a.txt", "b.txt"], {
					source: requiredStringPositional,
					targets: requiredStringArrayPositional,
				});
				expect(result).toEqual({ source: "src.txt", targets: ["a.txt", "b.txt"] });
			});

			test("parses 1 value for required array positional", () => {
				const result = parseArguments(["foo.txt"], { files: requiredStringArrayPositional });
				expect(result).toEqual({ files: ["foo.txt"] });
			});

			test("parses 2 values for required array positional", () => {
				const result = parseArguments(["foo.txt", "bar.txt"], {
					files: requiredStringArrayPositional,
				});
				expect(result).toEqual({ files: ["foo.txt", "bar.txt"] });
			});

			test("throws for 0 values for required array positional", () => {
				expect(() => parseArguments([], { files: requiredStringArrayPositional })).toThrow(
					"Missing required argument",
				);
			});

			test("supports array positional after non-array positional", () => {
				const result = parseArguments(["a", "b", "c"], {
					action: requiredStringPositional,
					files: requiredStringArrayPositional,
				});
				expect(result).toEqual({ action: "a", files: ["b", "c"] });
			});
		});

		describe("named", () => {
			test("parses 0 values for array named arg as undefined", () => {
				const result = parseArguments([], { tags: optionalStringArray });
				expect(result).toEqual({ tags: [] });
			});

			test("parses 1 value for array named arg as array", () => {
				const result = parseArguments(["--tags", "foo"], { tags: optionalStringArray });
				expect(result).toEqual({ tags: ["foo"] });
			});

			test("parses 2 values for array named arg as array", () => {
				const result = parseArguments(["--tags", "foo", "--tags", "bar"], {
					tags: optionalStringArray,
				});
				expect(result).toEqual({ tags: ["foo", "bar"] });
			});

			test("parses number array named", () => {
				const result = parseArguments(["--ids", "1", "--ids", "2", "--ids", "3"], {
					ids: optionalNumberArray,
				});
				expect(result).toEqual({ ids: [1, 2, 3] });
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

			test("throws for boolean array positional", () => {
				expect(() =>
					parseArguments([], {
						flags: { type: "boolean", positional: true, array: true },
					}),
				).toThrow("boolean array arguments are not supported (flags)");
			});

			test("throws for boolean array named", () => {
				expect(() =>
					parseArguments([], {
						flags: { type: "boolean", array: true },
					}),
				).toThrow("boolean array arguments are not supported (flags)");
			});
		});

		describe("type inference", () => {
			test("infers required positional array as non-empty", () => {
				const result = parseArguments(["a"], {
					files: { type: "string", positional: true, array: true, required: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ files: [string, ...string[]] }>();
			});

			test("infers optional named array as always present", () => {
				const result = parseArguments([], {
					tags: { type: "string", array: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ tags: string[] }>();
			});

			test("infers required named array as non-empty", () => {
				const result = parseArguments(["--tags", "a"], {
					tags: { type: "string", array: true, required: true },
				} as const satisfies ArgumentSchema);

				expectTypeOf(result).toEqualTypeOf<{ tags: [string, ...string[]] }>();
			});
		});
	});

	describe("default values", () => {
		test("uses default for missing positional", () => {
			const result = parseArguments([], {
				file: { type: "string", positional: true, default: "default.txt" },
			});
			expect(result).toEqual({ file: "default.txt" });
		});

		test("uses default for missing named", () => {
			const result = parseArguments([], { port: { type: "number", default: 8080 } });
			expect(result).toEqual({ port: 8080 });
		});

		test("provided value overrides default", () => {
			const result = parseArguments(["--port", "3000"], {
				port: { type: "number", default: 8080 },
			});
			expect(result).toEqual({ port: 3000 });
		});

		test("a required positional with a default value can be omitted", () => {
			const result = parseArguments([], {
				file: { type: "string", positional: true, required: true, default: "fallback.txt" },
			});
			expect(result).toEqual({ file: "fallback.txt" });
		});

		test("default ignores required for named", () => {
			const result = parseArguments([], {
				output: { type: "string", required: true, default: "out.txt" },
			});
			expect(result).toEqual({ output: "out.txt" });
		});

		test("default ignores required for positional array", () => {
			const result = parseArguments([], {
				files: {
					type: "string",
					positional: true,
					array: true,
					required: true,
					default: ["a.txt", "b.txt"],
				},
			});
			expect(result).toEqual({ files: ["a.txt", "b.txt"] });
		});

		test("default ignores required for named array", () => {
			const result = parseArguments([], {
				tags: { type: "string", array: true, required: true, default: ["dev", "test"] },
			});
			expect(result).toEqual({ tags: ["dev", "test"] });
		});

		test("infers non-optional type when named has default", () => {
			const result = parseArguments([], {
				port: { type: "number", default: 8080 },
			} as const satisfies ArgumentSchema);

			expectTypeOf(result).toEqualTypeOf<{ port: number }>();
		});

		test("infers non-optional type when positional has default", () => {
			const result = parseArguments([], {
				file: { type: "string", positional: true, default: "default.txt" },
			} as const satisfies ArgumentSchema);

			expectTypeOf(result).toEqualTypeOf<{ file: string }>();
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
});
