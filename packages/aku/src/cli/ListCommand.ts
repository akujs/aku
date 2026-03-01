import { inject } from "../container/inject.ts";
import { BaseCommand } from "./Command.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import type { CommandDefinition, CommandExecuteContext } from "./cli-types.ts";
import { defineCommand } from "./defineCommand.ts";

class ListCommandHandler extends BaseCommand {
	#registry: CommandRegistry;

	constructor(registry: CommandRegistry = inject(CommandRegistry)) {
		super();
		this.#registry = registry;
	}

	async execute({ cli }: CommandExecuteContext): Promise<void> {
		const commands = this.#registry.getCommandDefinitions();

		cli.h1("Available commands");
		cli.dl({
			items: commands.map((cmd) => ({ label: cmd.name, definition: cmd.description })),
		});
	}
}

export const listCommand: CommandDefinition = defineCommand({
	name: "list",
	description: "List all available commands",
	handler: ListCommandHandler,
});
