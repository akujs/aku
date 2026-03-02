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
import { parseArguments } from "./parseArguments.ts";
import { renderHelp } from "./renderHelp.ts";

const helpArgs = {
	command: {
		type: "string",
		positional: true,
		array: true,
		description: "The command to get help for",
	},
} as const satisfies ArgumentSchema;

class HelpCommandHandler extends BaseCommand {
	#registry: CommandRegistry;

	constructor(registry: CommandRegistry = inject(CommandRegistry)) {
		super();
		this.#registry = registry;
	}

	async execute({ args, cli }: CommandExecuteContext<InferArgs<typeof helpArgs>>): Promise<void> {
		if (args.command.length === 0) {
			cli.p("This is the command line interface for the Aku framework.");
			cli.p(
				'Try "aku list" for a list of available commands, or "aku help <command>" for help with a specific command.',
			);
			return;
		}

		// Try two-word command name first (e.g. "help db migrate")
		if (args.command.length >= 2) {
			const twoWordName = `${args.command[0]} ${args.command[1]}`;
			const definition = this.#registry.getDefinition(twoWordName);
			if (definition) {
				renderHelp(definition, cli);
				return;
			}
		}

		// Try single-word command name (e.g. "help greet" or "help greet Alice")
		const singleWordDef = this.#registry.getDefinition(args.command[0]);
		if (singleWordDef) {
			renderHelp(singleWordDef, cli);
			return;
		}

		// If the first arg matches a group name, delegate to list for that group
		const groupNames = this.#registry.getGroupNames();
		if (groupNames.includes(args.command[0])) {
			const listDef = this.#registry.getDefinition("list");
			if (listDef) {
				const execute = this.#registry.resolve("list")!;
				const parsedArgs = parseArguments([args.command[0]], listDef.args);
				await execute({ args: parsedArgs, cli });
				return;
			}
		}

		const commandName = args.command.join(" ");
		const similar = findSimilar(commandName, this.#registry.getCommandNames(), {
			threshold: 3,
			maxResults: 6,
		});
		let message = `Command "${commandName}" not found.`;
		if (similar.length > 0) {
			message += `\n\nDid you mean:\n${similar.map((s) => `  ${s}`).join("\n")}`;
		}
		message += `\n\nRun "aku list" to see available commands.`;
		throw new CliExitError(message);
	}
}

export const helpCommand: CommandDefinition = defineCommand({
	name: "help",
	description: "Show help for a command",
	args: helpArgs,
	handler: HelpCommandHandler,
});
