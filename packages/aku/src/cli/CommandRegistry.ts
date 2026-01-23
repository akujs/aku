import { Container } from "../container/contracts/Container.ts";
import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import type { Terminal } from "./contracts/Terminal.ts";

export interface Command {
	execute(args: string[], terminal: Terminal): Promise<void>;
}

// Represents a command class. Commands are registered as class references,
// allowing listing of available commands without instantiating them.
export interface CommandDefinition<T extends Command = Command> {
	readonly name: string;
	readonly description: string;
	new (): T;
}

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

	getCommandDefinitions(): CommandDefinition[] {
		return [...this.#commands.values()].sort((a, b) => a.name.localeCompare(b.name));
	}
}
