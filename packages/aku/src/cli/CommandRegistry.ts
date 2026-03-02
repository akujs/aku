import { Container } from "../container/contracts/Container.ts";
import { inject } from "../container/inject.ts";
import { BaseClass } from "../utils.ts";
import { isClassCommand } from "./Command.ts";
import type {
	CommandDefinition,
	CommandExecuteContext,
	CommandGroupDefinition,
} from "./cli-types.ts";

export class CommandRegistry extends BaseClass {
	#commands = new Map<string, CommandDefinition>();
	#groupDescriptions = new Map<string, string>();
	#container: Container;

	constructor(container: Container = inject(Container)) {
		super();
		this.#container = container;
	}

	register(definition: CommandDefinition): void {
		const groupPrefix = this.#getGroupPrefix(definition.name);
		if (groupPrefix) {
			// Grouped command — check no ungrouped command uses the group prefix as its name
			const existing = this.#commands.get(groupPrefix);
			if (existing && !this.#getGroupPrefix(existing.name)) {
				throw new Error(
					`Cannot register grouped command "${definition.name}": "${groupPrefix}" is already registered as an ungrouped command.`,
				);
			}
		} else {
			// Ungrouped command — check it doesn't clash with an existing group
			const groupNames = this.getGroupNames();
			if (groupNames.includes(definition.name)) {
				throw new Error(
					`Cannot register ungrouped command "${definition.name}": it conflicts with an existing command group of the same name.`,
				);
			}
		}
		this.#commands.set(definition.name, definition);
	}

	registerGroup(definition: CommandGroupDefinition): void {
		this.#groupDescriptions.set(definition.name, definition.description);
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

	resolveFromArgs(
		args: string[],
	): { definition: CommandDefinition; remainingArgs: string[] } | undefined {
		// Try two-word match first (more specific)
		if (args.length >= 2) {
			const twoWordName = `${args[0]} ${args[1]}`;
			const definition = this.#commands.get(twoWordName);
			if (definition) {
				return { definition, remainingArgs: args.slice(2) };
			}
		}

		// Try single-word match
		if (args.length >= 1) {
			const definition = this.#commands.get(args[0]);
			if (definition) {
				return { definition, remainingArgs: args.slice(1) };
			}
		}

		return undefined;
	}

	getCommandNames(): string[] {
		const ungrouped = [...this.#commands.values()]
			.filter((cmd) => !cmd.hidden && !this.#getGroupPrefix(cmd.name))
			.map((cmd) => cmd.name);
		const groups = this.getGroupNames();
		return [...ungrouped, ...groups].sort();
	}

	getDefinition(name: string): CommandDefinition | undefined {
		return this.#commands.get(name);
	}

	getCommandDefinitions(): CommandDefinition[] {
		return [...this.#commands.values()]
			.filter((cmd) => !cmd.hidden)
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	getGroupNames(): string[] {
		const groups = new Set<string>();
		for (const cmd of this.#commands.values()) {
			const prefix = this.#getGroupPrefix(cmd.name);
			if (prefix) {
				groups.add(prefix);
			}
		}
		return [...groups].sort();
	}

	getGroupDescription(name: string): string | undefined {
		return this.#groupDescriptions.get(name);
	}

	getDefinitionsInGroup(groupName: string): CommandDefinition[] {
		return [...this.#commands.values()]
			.filter((cmd) => !cmd.hidden && cmd.name.startsWith(groupName + " "))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	getUngroupedDefinitions(): CommandDefinition[] {
		return [...this.#commands.values()]
			.filter((cmd) => !cmd.hidden && !this.#getGroupPrefix(cmd.name))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	#getGroupPrefix(name: string): string | undefined {
		const spaceIndex = name.indexOf(" ");
		return spaceIndex >= 0 ? name.slice(0, spaceIndex) : undefined;
	}
}
