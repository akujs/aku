import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import type { Command, CommandExecuteContext } from "./cli-types.ts";

export class ListCommand extends BaseClass implements Command {
	static override readonly name = "list";
	static readonly description = "List all available commands";

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
