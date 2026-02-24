import type { NoArgConstructor } from "../utils.ts";
import { BaseClass } from "../utils.ts";
import type { CommandExecuteContext } from "./cli-types.ts";

/** A function that handles a CLI command. */
export type FunctionCommand<A = unknown> = (ctx: CommandExecuteContext<A>) => Promise<void>;

interface IClassCommandInstance<A = unknown> {
	execute(ctx: CommandExecuteContext<A>): Promise<void>;
}

/** A class constructor that handles a CLI command via dependency injection. */
export type ClassCommand<A = unknown> = NoArgConstructor<IClassCommandInstance<A>> & {
	isClassCommand: true;
};

/** A command handler — either a function or a class with DI support. */
export type CommandHandler<A = unknown> = FunctionCommand<A> | ClassCommand<A>;

/** Type guard that checks whether a command handler is a class-based command. */
export function isClassCommand(value: unknown): value is ClassCommand {
	return typeof value === "function" && "isClassCommand" in value && value.isClassCommand === true;
}

/**
 * Base class for CLI commands that need dependency injection.
 */
export abstract class BaseCommand extends BaseClass implements IClassCommandInstance {
	static readonly isClassCommand = true;

	abstract execute(ctx: CommandExecuteContext): Promise<void>;
}
