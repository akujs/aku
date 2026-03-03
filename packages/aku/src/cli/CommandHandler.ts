import { inject } from "../container/inject.ts";
import { findSimilar } from "../helpers/str/similarity.ts";
import { BaseClass } from "../utils.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import { CliExitError } from "./cli-errors.ts";
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
				const execute = this.#registry.resolve(definition.name)!;

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

			const commandName = args[0];
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
		} catch (error) {
			return this.#errorHandler.handleError(error, cli);
		}
	}

	#rewriteHelpFlag(args: string[]): string[] {
		if (!args.includes("--help")) return args;
		const nonFlagArgs = args.filter((arg) => !arg.startsWith("-"));
		return nonFlagArgs.length > 0 ? ["help", ...nonFlagArgs] : ["help"];
	}
}
