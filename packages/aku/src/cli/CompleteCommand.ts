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
		type: "number",
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
		const point = args.point ?? line.length;

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

	// Completing the first word (command name or group name)
	if (!commandName && !endsWithSpace) {
		return completeFirstWord(currentWord, registry);
	}
	if (!commandName && endsWithSpace) {
		return completeFirstWord("", registry);
	}
	if (commandName && words.length === 0 && !endsWithSpace) {
		return completeFirstWord(currentWord, registry);
	}

	// Check if the first word is a group name
	const groupNames = registry.getGroupNames();
	if (groupNames.includes(commandName)) {
		// We're inside a group — check if we're completing the subcommand
		const subcommand = words[1];
		if (!subcommand) {
			// No subcommand word typed yet — complete subcommand names
			return completeGroupSubcommand(commandName, currentWord, registry);
		}
		if (words.length === 1 && !endsWithSpace) {
			// Still typing the subcommand — complete subcommand names
			return completeGroupSubcommand(commandName, currentWord, registry);
		}
		// Past the subcommand — complete flags for the two-word command
		const twoWordName = `${commandName} ${subcommand}`;
		return completeArguments(twoWordName, currentWord, words.slice(2), registry);
	}

	// Completing arguments for an ungrouped command
	return completeArguments(commandName, currentWord, words.slice(1), registry);
}

function completeFirstWord(prefix: string, registry: CommandRegistry): string[] {
	return registry.getCommandNames().filter((name) => name.startsWith(prefix));
}

function completeGroupSubcommand(
	groupName: string,
	prefix: string,
	registry: CommandRegistry,
): string[] {
	const groupCommands = registry.getDefinitionsInGroup(groupName);
	return groupCommands
		.map((cmd) => cmd.name.split(" ")[1])
		.filter((name) => name.startsWith(prefix))
		.sort();
}

function completeArguments(
	commandName: string,
	currentWord: string,
	precedingArgs: string[],
	registry: CommandRegistry,
): string[] {
	if (currentWord.startsWith("-")) {
		const definition = registry.getDefinition(commandName);
		if (!definition?.args) return [];
		return completeFlags(definition.args, currentWord, precedingArgs);
	}

	// Special-case: help completes command and group names
	if (commandName === "help") {
		return registry.getCommandNames().filter((name) => name.startsWith(currentWord));
	}

	// Special-case: list completes group names
	if (commandName === "list") {
		return registry.getGroupNames().filter((name) => name.startsWith(currentWord));
	}

	const definition = registry.getDefinition(commandName);
	if (!definition?.args) return [];
	return completeFlags(definition.args, currentWord, precedingArgs);
}

function completeFlags(schema: ArgumentSchema, prefix: string, precedingArgs: string[]): string[] {
	const usedFlags = new Set(
		precedingArgs.filter((w) => w.startsWith("--")).map((w) => w.split("=")[0]),
	);

	const flags: string[] = [];
	for (const [name, def] of Object.entries(schema)) {
		if (def.positional) continue;
		const flagName = `--${kebabCase(name)}`;
		if (usedFlags.has(flagName) && !def.array) continue;
		const completion = def.type === "boolean" ? flagName : `${flagName}=`;
		if (completion.startsWith(prefix)) {
			flags.push(completion);
		}
	}
	return flags.sort();
}
