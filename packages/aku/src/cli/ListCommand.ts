import { inject } from "../container/inject.ts";
import { BaseCommand } from "./Command.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import { throwNotFoundError } from "./cli-errors.ts";
import type {
	ArgumentSchema,
	CommandDefinition,
	CommandExecuteContext,
	InferArgs,
} from "./cli-types.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import { defineCommand } from "./defineCommand.ts";
import { formatOutput } from "./formatOutput.ts";

const listArgs = {
	group: {
		type: "string",
		positional: true,
		description: "Show only commands in this group",
	},
	format: {
		type: "string",
		description: "Output format (json)",
	},
	pretty: {
		type: "boolean",
		description: "Pretty-print JSON output with indentation",
	},
} as const satisfies ArgumentSchema;

export function outputHumanCommandList(
	group: string,
	registry: CommandRegistry,
	cli: CliApi,
): void {
	const groupCommands = registry.getDefinitionsInGroup(group);
	const description = registry.getGroupDescription(group) ?? group;
	cli.h1(description);
	cli.dl({
		items: groupCommands.map((cmd) => ({
			label: cmd.name.split(" ")[1],
			definition: cmd.description,
		})),
	});
}

export function formatMachineCommandList(
	group: string,
	registry: CommandRegistry,
	format: string,
	pretty: boolean,
): string {
	const commands = registry.getDefinitionsInGroup(group);
	const data = {
		commands: commands.map((cmd) => ({ command: cmd.name, description: cmd.description })),
	};
	return formatOutput(data, format, pretty);
}

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
				throwNotFoundError("Command group", args.group, groupNames);
			}
		}

		if (!args.format) {
			this.#renderDefault(args, cli);
			return;
		}

		if (args.group) {
			cli.raw(formatMachineCommandList(args.group, this.#registry, args.format, args.pretty));
			return;
		}

		const data = {
			commands: this.#registry
				.getCommandDefinitions()
				.map((cmd) => ({ command: cmd.name, description: cmd.description })),
		};
		cli.raw(formatOutput(data, args.format, args.pretty));
	}

	#renderDefault(args: InferArgs<typeof listArgs>, cli: CommandExecuteContext["cli"]): void {
		if (args.group) {
			outputHumanCommandList(args.group, this.#registry, cli);
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
