import type { CommandHandler } from "./Command.ts";
import type { ArgumentSchema, CommandDefinition, InferArgs } from "./cli-types.ts";

const VALID_COMMAND_NAME = /^[\w-]+( [\w-]+)?$/;

/**
 * Create a command definition with typed arguments.
 */
export function defineCommand<S extends ArgumentSchema>(options: {
	name: string;
	description: string;
	args: S;
	hidden?: boolean | undefined;
	handler: CommandHandler<InferArgs<S>>;
}): CommandDefinition;

/**
 * Create a command definition without arguments.
 */
export function defineCommand(options: {
	name: string;
	description: string;
	hidden?: boolean | undefined;
	handler: CommandHandler;
}): CommandDefinition;

// Implementation uses a broad handler type to satisfy both overloads
export function defineCommand(options: {
	name: string;
	description: string;
	args?: ArgumentSchema | undefined;
	hidden?: boolean | undefined;
	handler: CommandHandler<never>;
}): CommandDefinition {
	if (!VALID_COMMAND_NAME.test(options.name)) {
		throw new Error(
			`Invalid command name "${options.name}". Command names must be a single word or two words separated by a space (e.g. "greet" or "db migrate").`,
		);
	}
	return {
		name: options.name,
		description: options.description,
		args: options.args,
		hidden: options.hidden,
		handler: options.handler as CommandHandler,
	};
}
