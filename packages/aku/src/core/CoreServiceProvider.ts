import { CommandHandler } from "../cli/CommandHandler.ts";
import { CommandRegistry } from "../cli/CommandRegistry.ts";
import type { CommandDefinition } from "../cli/cli-types.ts";
import { CliErrorHandler } from "../cli/contracts/CliErrorHandler.ts";
import { DefaultCliErrorHandler } from "../cli/DefaultCliErrorHandler.ts";
import { helpCommand } from "../cli/HelpCommand.ts";
import { listCommand } from "../cli/ListCommand.ts";
import { Dispatcher } from "./contracts/Dispatcher.ts";
import { DispatcherImpl } from "./DispatcherImpl.ts";
import { ServiceProvider } from "./ServiceProvider.ts";

export class CoreServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(Dispatcher, DispatcherImpl);
		this.container.singleton(CommandRegistry);
		this.container.singleton(CommandHandler);
		this.container.singleton(CliErrorHandler, DefaultCliErrorHandler);
	}

	override get commands(): CommandDefinition[] {
		return [helpCommand, listCommand];
	}
}
