import { inject } from "../container/inject.ts";
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
import { renderHelp } from "./renderHelp.ts";

const helpArgs = {
	command: { type: "string", positional: true, description: "The command to get help for" },
} as const satisfies ArgumentSchema;

class HelpCommandHandler extends BaseCommand {
	#registry: CommandRegistry;

	constructor(registry: CommandRegistry = inject(CommandRegistry)) {
		super();
		this.#registry = registry;
	}

	async execute({ args, cli }: CommandExecuteContext<InferArgs<typeof helpArgs>>): Promise<void> {
		if (!args.command) {
			cli.p("This is the command line interface for the Aku framework.");
			cli.p(
				'Try "aku list" for a list of available commands, or "aku help <command>" for help with a specific command.',
			);
			return;
		}

		const definition = this.#registry.getDefinition(args.command);
		if (!definition) {
			const similar = findSimilar(args.command, this.#registry.getCommandNames(), {
				threshold: 3,
				maxResults: 6,
			});
			let message = `Command "${args.command}" not found.`;
			if (similar.length > 0) {
				message += `\n\nDid you mean:\n${similar.map((s) => `  ${s}`).join("\n")}`;
			}
			message += `\n\nRun "aku list" to see available commands.`;
			throw new CliExitError(message);
		}

		renderHelp(definition, cli);
	}
}

export const helpCommand: CommandDefinition = defineCommand({
	name: "help",
	description: "Show help for a command",
	args: helpArgs,
	handler: HelpCommandHandler,
});
