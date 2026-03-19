import { describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import type { CommandDefinition } from "./cli-types.ts";

function makeDefinition(name: string): CommandDefinition {
	return {
		name,
		description: `The ${name} command`,
		handler: async () => {},
	};
}

function createRegistry(): CommandRegistry {
	return new CommandRegistry(new ContainerImpl());
}

describe(CommandRegistry, () => {
	describe("register conflict detection", () => {
		test("throws when registering a grouped command whose prefix matches an existing ungrouped command", () => {
			const registry = createRegistry();
			registry.register(makeDefinition("db"));

			expect(() => registry.register(makeDefinition("db migrate"))).toThrow(
				'Cannot register grouped command "db migrate": "db" is already registered as an ungrouped command.',
			);
		});

		test("throws when registering an ungrouped command that conflicts with an existing group", () => {
			const registry = createRegistry();
			registry.register(makeDefinition("db migrate"));

			expect(() => registry.register(makeDefinition("db"))).toThrow(
				'Cannot register ungrouped command "db": it conflicts with an existing command group of the same name.',
			);
		});

		test("allows registering multiple commands in the same group", () => {
			const registry = createRegistry();
			registry.register(makeDefinition("db migrate"));
			registry.register(makeDefinition("db seed"));

			expect(registry.getDefinition("db migrate")).toBeDefined();
			expect(registry.getDefinition("db seed")).toBeDefined();
		});

		test("allows registering unrelated ungrouped commands", () => {
			const registry = createRegistry();
			registry.register(makeDefinition("serve"));
			registry.register(makeDefinition("build"));

			expect(registry.getDefinition("serve")).toBeDefined();
			expect(registry.getDefinition("build")).toBeDefined();
		});
	});
});
