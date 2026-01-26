import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import { CliExitError } from "./cli-errors.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import { CliErrorHandler as CliErrorHandlerToken } from "./contracts/CliErrorHandler.ts";

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
			const commandName = args[0] ?? "list";
			const commandArgs = args.slice(1);

			const command = this.#registry.resolve(commandName);

			if (!command) {
				throw new CliExitError(
					`Command "${commandName}" not found. Run "aku list" to see available commands.`,
				);
			}

			await command.execute({ args: commandArgs, cli });
			return 0;
		} catch (error) {
			return this.#errorHandler.handleError(error, cli);
		}
	}
}
