import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import { CliExitError, throwNotFoundError } from "./cli-errors.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import { CliErrorHandler as CliErrorHandlerToken } from "./contracts/CliErrorHandler.ts";
import { outputHumanCommandList } from "./ListCommand.ts";
import { parseArguments } from "./parseArguments.ts";
import { outputHumanCommandHelp } from "./renderHelp.ts";

export class CommandHandler extends BaseClass {
	#registry: CommandRegistry;
	#errorHandler: CliErrorHandler;

	constructor(
		registry: CommandRegistry = inject(CommandRegistry),
		errorHandler: CliErrorHandler = inject(CliErrorHandlerToken),
	) {
		super();
		this.#registry = registry;
		this.#errorHandler = errorHandler;
	}

	async handle(args: string[], cli: CliApi): Promise<number> {
		try {
			args = this.#rewriteHelpFlag(args);

			if (args.length === 0) {
				args = ["list"];
			}

			const resolved = this.#registry.resolveFromArgs(args);

			if (resolved) {
				const { definition, remainingArgs } = resolved;
				const execute = this.#registry.resolve(definition.name);
				if (!execute) {
					throw new CliExitError(`Command "${definition.name}" could not be resolved.`);
				}

				let parsedArgs;
				try {
					parsedArgs = parseArguments(remainingArgs, definition.args);
				} catch (error) {
					if (error instanceof CliExitError) {
						outputHumanCommandHelp(definition, cli);
					}
					throw error;
				}

				await execute({ args: parsedArgs, cli });
				return 0;
			}

			// Check if the first arg is a group name — show commands in that group
			const groupNames = this.#registry.getGroupNames();
			if (groupNames.includes(args[0])) {
				outputHumanCommandList(args[0], this.#registry, cli);
				return 0;
			}

			throwNotFoundError("Command", args[0], this.#registry.getCommandNames());
		} catch (error) {
			return this.#errorHandler.handleError(error, cli);
		}
	}

	#rewriteHelpFlag(args: string[]): string[] {
		if (!args.includes("--help")) return args;
		const rest = args.filter((arg) => arg !== "--help");
		return ["help", ...rest];
	}
}
