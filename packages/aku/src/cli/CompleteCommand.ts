import { inject } from "../container/inject.ts";
import { kebabCase } from "../helpers/str/case.ts";
import { BaseCommand } from "./Command.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import type {
	ArgumentSchema,
	CommandDefinition,
	CommandExecuteContext,
	InferArgs,
} from "./cli-types.ts";
import { defineCommand } from "./defineCommand.ts";

const completeArgs = {
	line: {
		type: "string",
		positional: true,
		description: "The full command line",
	},
	point: {
		type: "string",
		positional: true,
		description: "The cursor position",
	},
} as const satisfies ArgumentSchema;

class CompleteCommandHandler extends BaseCommand {
	#registry: CommandRegistry;

	constructor(registry: CommandRegistry = inject(CommandRegistry)) {
		super();
		this.#registry = registry;
	}

	async execute({
		args,
		cli,
	}: CommandExecuteContext<InferArgs<typeof completeArgs>>): Promise<void> {
		const line = args.line ?? "";
		const point = Number(args.point ?? line.length);

		const completions = getCompletions(line, point, this.#registry);
		if (completions.length > 0) {
			cli.raw(completions.join("\n") + "\n");
		}
	}
}

export const completeCommand: CommandDefinition = defineCommand({
	name: "_complete",
	description: "Provide shell completions",
	hidden: true,
	args: completeArgs,
	handler: CompleteCommandHandler,
});

export function getCompletions(line: string, point: number, registry: CommandRegistry): string[] {
	const relevantLine = line.slice(0, point);
	const words = relevantLine.split(/\s+/).filter(Boolean);

	// Remove the program name (e.g. "aku")
	words.shift();

	const endsWithSpace = relevantLine.endsWith(" ");
	const currentWord = endsWithSpace ? "" : (words.pop() ?? "");
	const commandName = words[0];

	// Completing the command name (first argument after program name)
	if (!commandName && !endsWithSpace) {
		// Still typing the first word
		return completeCommandName(currentWord, registry);
	}
	if (!commandName && endsWithSpace) {
		// No words after program name, space pressed — list all commands
		return completeCommandName("", registry);
	}
	if (commandName && words.length === 0 && !endsWithSpace) {
		// The only word is still being typed — complete command name
		return completeCommandName(currentWord, registry);
	}

	// Completing arguments for a specific command
	return completeArguments(commandName, currentWord, registry);
}

function completeCommandName(prefix: string, registry: CommandRegistry): string[] {
	return registry.getCommandNames().filter((name) => name.startsWith(prefix));
}

function completeArguments(
	commandName: string,
	currentWord: string,
	registry: CommandRegistry,
): string[] {
	const definition = registry.getDefinition(commandName);
	if (!definition?.args) return [];

	if (currentWord.startsWith("-")) {
		return completeFlags(definition.args, currentWord);
	}

	return [];
}

function completeFlags(schema: ArgumentSchema, prefix: string): string[] {
	const flags: string[] = [];
	for (const [name, def] of Object.entries(schema)) {
		if (!def.positional) {
			const flagName = `--${kebabCase(name)}`;
			if (flagName.startsWith(prefix)) {
				flags.push(flagName);
			}
		}
	}
	return flags.sort();
}
