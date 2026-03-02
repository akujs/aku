import { inject } from "../container/inject.ts";
import { formatToon } from "../helpers/format/toon.ts";
import { BaseCommand } from "./Command.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import { CliExitError } from "./cli-errors.ts";
import type {
	ArgumentSchema,
	CommandDefinition,
	CommandExecuteContext,
	InferArgs,
} from "./cli-types.ts";
import { defineCommand } from "./defineCommand.ts";

const listArgs = {
	format: {
		type: "string",
		description: "Output format (json or toon)",
	},
	pretty: {
		type: "boolean",
		description: "Pretty-print JSON output with indentation",
	},
} as const satisfies ArgumentSchema;

class ListCommandHandler extends BaseCommand {
	#registry: CommandRegistry;

	constructor(registry: CommandRegistry = inject(CommandRegistry)) {
		super();
		this.#registry = registry;
	}

	async execute({ args, cli }: CommandExecuteContext<InferArgs<typeof listArgs>>): Promise<void> {
		const commands = this.#registry.getCommandDefinitions();

		if (!args.format) {
			cli.h1("Available commands");
			cli.dl({
				items: commands.map((cmd) => ({ label: cmd.name, definition: cmd.description })),
			});
			return;
		}

		const data = {
			commands: commands.map((cmd) => ({ command: cmd.name, description: cmd.description })),
		};

		switch (args.format) {
			case "json":
				cli.raw(args.pretty ? JSON.stringify(data, null, "    ") : JSON.stringify(data));
				break;
			case "toon":
				cli.raw(formatToon(data));
				break;
			default:
				throw new CliExitError(`Unknown format: "${args.format}". Supported formats: json, toon`);
		}
	}
}

export const listCommand: CommandDefinition = defineCommand({
	name: "list",
	description: "List all available commands",
	args: listArgs,
	handler: ListCommandHandler,
});
