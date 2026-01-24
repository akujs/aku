import { type CommandDefinition, CommandRegistry } from "../cli/CommandRegistry.ts";
import { CliErrorHandler } from "../cli/contracts/CliErrorHandler.ts";
import { DefaultCliErrorHandler } from "../cli/DefaultCliErrorHandler.ts";
import { ListCommand } from "../cli/ListCommand.ts";
import { Dispatcher } from "./contracts/Dispatcher.ts";
import { DispatcherImpl } from "./DispatcherImpl.ts";
import { ServiceProvider } from "./ServiceProvider.ts";

export class CoreServiceProvider extends ServiceProvider {
	override register(): void {
		this.container.singleton(Dispatcher, DispatcherImpl);
		this.container.singleton(CommandRegistry);
		this.container.singleton(CliErrorHandler, DefaultCliErrorHandler);
	}

	override get commands(): CommandDefinition[] {
		return [ListCommand];
	}
}
