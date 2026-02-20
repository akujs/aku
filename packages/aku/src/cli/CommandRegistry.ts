import { Container } from "../container/contracts/Container.ts";
import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import type { Command, CommandDefinition } from "./cli-types.ts";

export class CommandRegistry extends BaseClass {
	#commands = new Map<string, CommandDefinition>();
	#container: Container;

	constructor(container: Container = inject(Container)) {
		super();
		this.#container = container;
	}

	register(commandClass: CommandDefinition): void {
		this.#commands.set(commandClass.name, commandClass);
	}

	resolve(name: string): Command | undefined {
		const definition = this.#commands.get(name);
		return definition ? this.#container.withInject(() => new definition()) : undefined;
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
