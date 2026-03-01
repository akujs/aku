import { describe, expect, test } from "bun:test";
import type { ArgumentSchema, CommandDefinition } from "./cli-types.ts";
import { defineCommand } from "./defineCommand.ts";
import { MemoryCliApi } from "./MemoryCliApi.ts";
import { renderHelp } from "./renderHelp.ts";

function renderToMemory(definition: CommandDefinition): MemoryCliApi["outputs"] {
	const cli = new MemoryCliApi();
	renderHelp(definition, cli);
	return cli.outputs;
}

describe(renderHelp, () => {
	test("renders command name as h1 and description as paragraph", () => {
		const cmd = defineCommand({
			name: "greet",
			description: "Greet someone by name",
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).toContainEqual({ h1: "greet" });
		expect(output).toContainEqual({ paragraph: "Greet someone by name" });
	});

	test("renders usage line for command with no args", () => {
		const cmd = defineCommand({
			name: "status",
			description: "Show status",
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).toContainEqual({ h2: "Usage" });
		expect(output).toContainEqual({ paragraph: "  status" });
	});

	test("renders usage line with positionals, required named, and [options]", () => {
		const args = {
			name: { type: "string", positional: true, required: true },
			greeting: { type: "string", positional: true },
			count: { type: "number", required: true },
			verbose: { type: "boolean" },
		} as const satisfies ArgumentSchema;

		const cmd = defineCommand({
			name: "greet",
			description: "Greet someone",
			args,
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).toContainEqual({
			paragraph: "  greet <name> [greeting] --count=<value> [options]",
		});
	});

	test("renders usage line omitting [options] when all named args are required", () => {
		const args = {
			file: { type: "string", positional: true, required: true },
			output: { type: "string", required: true },
		} as const satisfies ArgumentSchema;

		const cmd = defineCommand({
			name: "compile",
			description: "Compile a file",
			args,
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).toContainEqual({
			paragraph: "  compile <file> --output=<value>",
		});
	});

	test("renders arguments section with dl", () => {
		const args = {
			file: {
				type: "string",
				positional: true,
				required: true,
				description: "The file to process",
			},
		} as const satisfies ArgumentSchema;

		const cmd = defineCommand({
			name: "process",
			description: "Process a file",
			args,
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).toContainEqual({ h2: "Arguments" });
		expect(output).toContainEqual({
			dl: {
				items: [
					{
						label: "<file>",
						definition: "The file to process (required)",
					},
				],
			},
		});
	});

	test("renders options section with dl", () => {
		const args = {
			verbose: {
				type: "boolean",
				description: "Enable verbose output",
			},
		} as const satisfies ArgumentSchema;

		const cmd = defineCommand({
			name: "run",
			description: "Run something",
			args,
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).toContainEqual({ h2: "Options" });
		expect(output).toContainEqual({
			dl: {
				items: [
					{
						label: "--verbose",
						definition: "Enable verbose output (optional)",
					},
				],
			},
		});
	});

	test("omits arguments section when no positionals", () => {
		const args = {
			verbose: { type: "boolean" },
		} as const satisfies ArgumentSchema;

		const cmd = defineCommand({
			name: "run",
			description: "Run something",
			args,
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).not.toContainEqual({ h2: "Arguments" });
		expect(output).toContainEqual({ h2: "Options" });
	});

	test("omits options section when no named args", () => {
		const args = {
			file: { type: "string", positional: true, required: true },
		} as const satisfies ArgumentSchema;

		const cmd = defineCommand({
			name: "open",
			description: "Open a file",
			args,
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).toContainEqual({ h2: "Arguments" });
		expect(output).not.toContainEqual({ h2: "Options" });
	});

	test("full snapshot with mixed arg types", () => {
		const args = {
			name: {
				type: "string",
				positional: true,
				required: true,
				description: "The person to greet",
			},
			greeting: {
				type: "string",
				positional: true,
				default: "hello",
				description: "The greeting to use",
			},
			count: {
				type: "number",
				required: true,
				description: "Number of times to repeat",
			},
			verbose: {
				type: "boolean",
				description: "Enable verbose output",
			},
			tags: {
				type: "string",
				array: true,
				description: "Tags to apply",
			},
		} as const satisfies ArgumentSchema;

		const cmd = defineCommand({
			name: "greet",
			description: "Greet someone by name",
			args,
			handler: async () => {},
		});

		const output = renderToMemory(cmd);

		expect(output).toMatchInlineSnapshot(`
		  [
		    {
		      "h1": "greet",
		    },
		    {
		      "paragraph": "Greet someone by name",
		    },
		    {
		      "h2": "Usage",
		    },
		    {
		      "paragraph": "  greet <name> [greeting] --count=<value> [options]",
		    },
		    {
		      "h2": "Arguments",
		    },
		    {
		      "dl": {
		        "items": [
		          {
		            "definition": "The person to greet (required)",
		            "label": "<name>",
		          },
		          {
		            "definition": "The greeting to use (optional, default: "hello")",
		            "label": "[greeting]",
		          },
		        ],
		      },
		    },
		    {
		      "h2": "Options",
		    },
		    {
		      "dl": {
		        "items": [
		          {
		            "definition": "Number of times to repeat (number, required)",
		            "label": "--count=<value>",
		          },
		          {
		            "definition": "Enable verbose output (optional)",
		            "label": "--verbose",
		          },
		          {
		            "definition": "Tags to apply (optional, repeatable)",
		            "label": "--tags=<value>",
		          },
		        ],
		      },
		    },
		  ]
		`);
	});
});
