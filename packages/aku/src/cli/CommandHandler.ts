import { inject } from "../container/inject.ts";
import { findSimilar } from "../helpers/str/similarity.ts";
import { BaseClass } from "../utils.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import { CliExitError } from "./cli-errors.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import type { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import { CliErrorHandler as CliErrorHandlerToken } from "./contracts/CliErrorHandler.ts";
import { parseArguments } from "./parseArguments.ts";
import { renderHelp } from "./renderHelp.ts";

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

			const commandName = args[0] ?? "list";
			const commandArgs = args.slice(1);

			const definition = this.#registry.getDefinition(commandName);

			if (!definition) {
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

			const execute = this.#registry.resolve(commandName)!;

			let parsedArgs;
			try {
				parsedArgs = parseArguments(commandArgs, definition.args);
			} catch (error) {
				if (error instanceof CliExitError) {
					renderHelp(definition, cli);
				}
				throw error;
			}

			await execute({ args: parsedArgs, cli });
			return 0;
		} catch (error) {
			return this.#errorHandler.handleError(error, cli);
		}
	}

	#rewriteHelpFlag(args: string[]): string[] {
		if (!args.includes("--help")) return args;
		const commandName = args.find((arg) => !arg.startsWith("-"));
		return commandName ? ["help", commandName] : ["help"];
	}
}
