import type { CliApi } from "./contracts/CliApi.ts";

/***/
export interface CommandExecuteContext {
	args: string[];
	cli: CliApi;
}

/**
 *
 */
export interface Command {
	execute(context: CommandExecuteContext): Promise<void>;
}

/**
 * A command for the CLI. This is the type of a command class, describing its
 * static properties.
 */
export interface CommandDefinition<T extends Command = Command> {
	readonly name: string;
	readonly description: string;
	new (): T;
}
