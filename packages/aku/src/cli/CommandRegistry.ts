import { Container } from "../container/contracts/Container.ts";
import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import { isClassCommand } from "./Command.ts";
import type { CommandDefinition, CommandExecuteContext } from "./cli-types.ts";

export class CommandRegistry extends BaseClass {
	#commands = new Map<string, CommandDefinition>();
	#container: Container;

	constructor(container: Container = inject(Container)) {
		super();
		this.#container = container;
	}

	register(definition: CommandDefinition): void {
		this.#commands.set(definition.name, definition);
	}

	resolve(name: string): ((ctx: CommandExecuteContext) => Promise<void>) | undefined {
		const definition = this.#commands.get(name);
		if (!definition) return undefined;

		if (isClassCommand(definition.handler)) {
			const instance = this.#container.get(definition.handler);
			return (ctx) => instance.execute(ctx);
		}
		return definition.handler as (ctx: CommandExecuteContext) => Promise<void>;
	}

	getCommandNames(): string[] {
		return [...this.#commands.keys()].sort();
	}

	getDefinition(name: string): CommandDefinition | undefined {
		return this.#commands.get(name);
	}

	getCommandDefinitions(): CommandDefinition[] {
		return [...this.#commands.values()].sort((a, b) => a.name.localeCompare(b.name));
	}
}
