import { defineCommand } from "@akujs/aku/cli";

const argsDemoArgs = {
	file: {
		type: "string",
		positional: true,
		required: true,
		description: "File to process",
	},
	output: {
		type: "string",
		description: "Output path",
	},
	count: {
		type: "number",
		required: true,
		description: "Number of iterations",
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
} as const;

export const argsDemoCommand = defineCommand({
	name: "demo args",
	description: "Exercise various argument types",
	args: argsDemoArgs,
	handler: async ({ args, cli }) => {
		cli.h1("Parsed arguments");
		cli.dl({
			items: [
				{ label: "file", definition: args.file },
				{ label: "output", definition: args.output ?? "(not set)" },
				{ label: "count", definition: String(args.count) },
				{ label: "verbose", definition: String(args.verbose) },
				{ label: "tags", definition: args.tags.length > 0 ? args.tags.join(", ") : "(none)" },
			],
		});
	},
});
