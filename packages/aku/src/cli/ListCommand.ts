import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import type { Command } from "./CommandRegistry.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import type { TerminalUi } from "./TerminalUi.ts";

export class ListCommand extends BaseClass implements Command {
	static override readonly name = "list";
	static readonly description = "List all available commands";

	#registry: CommandRegistry;

	constructor(registry: CommandRegistry = inject(CommandRegistry)) {
		super();
		this.#registry = registry;
	}

	async execute(_args: string[], terminal: TerminalUi): Promise<void> {
		const commands = this.#registry.getCommandDefinitions();

		terminal.title("Available commands");
		terminal.definitionList(
			commands.map((cmd) => ({ label: cmd.name, definition: cmd.description })),
		);
	}
}
