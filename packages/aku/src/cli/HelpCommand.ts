import { inject } from "../container/inject.ts";
import { withoutUndefinedValues } from "../utils.ts";
import { BaseCommand } from "./Command.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import { CliExitError, throwNotFoundError } from "./cli-errors.ts";
import type {
	ArgumentDefinition,
	ArgumentSchema,
	CommandDefinition,
	CommandExecuteContext,
	InferArgs,
} from "./cli-types.ts";
import { defineCommand } from "./defineCommand.ts";
import { buildUsageLine } from "./formatArgument.ts";
import { formatOutput } from "./formatOutput.ts";
import { formatMachineCommandList, outputHumanCommandList } from "./ListCommand.ts";
import { outputHumanCommandHelp } from "./renderHelp.ts";

const helpArgs = {
	command: {
		type: "string",
		positional: true,
		array: true,
		description: "The command to get help for",
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

class HelpCommandHandler extends BaseCommand {
	#registry: CommandRegistry;

	constructor(registry: CommandRegistry = inject(CommandRegistry)) {
		super();
		this.#registry = registry;
	}

	async execute({ args, cli }: CommandExecuteContext<InferArgs<typeof helpArgs>>): Promise<void> {
		if (args.command.length === 0) {
			if (args.format) {
				throw new CliExitError(
					"The --format option requires a command name. Usage: aku help <command> --format json",
				);
			}
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
				if (args.format) {
					cli.raw(formatMachineCommandHelp(definition, args.format, args.pretty));
				} else {
					outputHumanCommandHelp(definition, cli);
				}
				return;
			}
		}

		// Try single-word command name (e.g. "help greet" or "help greet Alice")
		const singleWordDef = this.#registry.getDefinition(args.command[0]);
		if (singleWordDef) {
			if (args.format) {
				cli.raw(formatMachineCommandHelp(singleWordDef, args.format, args.pretty));
			} else {
				outputHumanCommandHelp(singleWordDef, cli);
			}
			return;
		}

		// If the first arg matches a group name and no further args, show list for that group
		const groupNames = this.#registry.getGroupNames();
		if (groupNames.includes(args.command[0]) && args.command.length === 1) {
			if (args.format) {
				cli.raw(
					formatMachineCommandList(args.command[0], this.#registry, args.format, args.pretty),
				);
			} else {
				outputHumanCommandList(args.command[0], this.#registry, cli);
			}
			return;
		}

		throwNotFoundError("Command", args.command.join(" "), this.#registry.getCommandNames());
	}
}

function formatMachineCommandHelp(
	definition: CommandDefinition,
	format: string,
	pretty: boolean,
): string {
	const entries = Object.entries(definition.args ?? {});

	const data = {
		command: definition.name,
		description: definition.description,
		usage: buildUsageLine(definition),
		args: entries.map(([name, def]) => buildArgData(name, def)),
	};

	return formatOutput(data, format, pretty);
}

function buildArgData(name: string, def: ArgumentDefinition): Record<string, unknown> {
	return withoutUndefinedValues({
		name,
		type: def.type,
		positional: def.positional === true,
		required: def.required === true && def.default === undefined,
		description: def.description,
		default: def.default,
		array: def.array || undefined,
	});
}

export const helpCommand: CommandDefinition = defineCommand({
	name: "help",
	description: "Show help for a command",
	args: helpArgs,
	handler: HelpCommandHandler,
});
