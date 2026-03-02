import { inject } from "../container/inject.ts";
import { formatToon } from "../helpers/format/toon.ts";
import { findSimilar } from "../helpers/str/similarity.ts";
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
	group: {
		type: "string",
		positional: true,
		description: "Show only commands in this group",
	},
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
		if (args.group) {
			const groupNames = this.#registry.getGroupNames();
			if (!groupNames.includes(args.group)) {
				const similar = findSimilar(args.group, groupNames, {
					threshold: 3,
					maxResults: 6,
				});
				let message = `Command group "${args.group}" not found.`;
				if (similar.length > 0) {
					message += `\n\nDid you mean:\n${similar.map((s) => `  ${s}`).join("\n")}`;
				}
				message += `\n\nRun "aku list" to see available commands.`;
				throw new CliExitError(message);
			}
		}

		if (!args.format) {
			this.#renderDefault(args, cli);
			return;
		}

		const commands = args.group
			? this.#registry.getDefinitionsInGroup(args.group)
			: this.#registry.getCommandDefinitions();

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

	#renderDefault(args: InferArgs<typeof listArgs>, cli: CommandExecuteContext["cli"]): void {
		if (args.group) {
			const groupCommands = this.#registry.getDefinitionsInGroup(args.group);
			const description = this.#registry.getGroupDescription(args.group) ?? args.group;
			cli.h1(description);
			cli.dl({
				items: groupCommands.map((cmd) => ({
					label: cmd.name.split(" ")[1],
					definition: cmd.description,
				})),
			});
			return;
		}

		const ungrouped = this.#registry.getUngroupedDefinitions();
		const groupNames = this.#registry.getGroupNames();

		if (groupNames.length === 0) {
			// No groups — simple flat list
			cli.h1("Available commands");
			cli.dl({
				items: ungrouped.map((cmd) => ({ label: cmd.name, definition: cmd.description })),
			});
			return;
		}

		// Mixed: ungrouped first, then each group
		cli.h1("Available commands");
		if (ungrouped.length > 0) {
			cli.dl({
				items: ungrouped.map((cmd) => ({ label: cmd.name, definition: cmd.description })),
			});
		}

		for (const groupName of groupNames) {
			const groupCommands = this.#registry.getDefinitionsInGroup(groupName);
			const description = this.#registry.getGroupDescription(groupName) ?? groupName;
			cli.h2(description);
			cli.dl({
				items: groupCommands.map((cmd) => ({
					label: cmd.name.split(" ")[1],
					definition: cmd.description,
				})),
			});
		}
	}
}

export const listCommand: CommandDefinition = defineCommand({
	name: "list",
	description: "List all available commands",
	args: listArgs,
	handler: ListCommandHandler,
});
