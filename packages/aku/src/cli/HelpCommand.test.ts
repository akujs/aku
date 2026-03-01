import { describe, expect, test } from "bun:test";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http.test-utils.ts";
import type { ArgumentSchema } from "./cli-types.ts";
import { defineCommand } from "./defineCommand.ts";
import { helpCommand } from "./HelpCommand.ts";

const greetArgs = {
	name: {
		type: "string",
		positional: true,
		required: true,
		description: "The person to greet",
	},
	verbose: {
		type: "boolean",
		description: "Enable verbose output",
	},
} as const satisfies ArgumentSchema;

const greetCommand = defineCommand({
	name: "greet",
	description: "Greet someone by name",
	args: greetArgs,
	handler: async () => {},
});

const simpleCommand = defineCommand({
	name: "simple",
	description: "A command with no args",
	handler: async () => {},
});

class TestProvider extends ServiceProvider {
	override get commands() {
		return [greetCommand, simpleCommand];
	}
}

describe(helpCommand.handler, () => {
	test("displays help for a known command with args", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.handleCommand(["help", "greet"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toContainEqual({ h1: "greet" });
		expect(cli.output).toContainEqual({ paragraph: "Greet someone by name" });
		expect(cli.output).toContainEqual({ h2: "Arguments" });
		expect(cli.output).toContainEqual({ h2: "Options" });
	});

	test("displays help for a command with no args", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.handleCommand(["help", "simple"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toContainEqual({ h1: "simple" });
		expect(cli.output).toContainEqual({ paragraph: "A command with no args" });
	});

	test("shows 'did you mean' for close misspelling", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.handleCommand(["help", "gret"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect((cli.lastError!.error as Error).message).toContain('Command "gret" not found.');
		expect((cli.lastError!.error as Error).message).toContain("Did you mean");
		expect((cli.lastError!.error as Error).message).toContain("greet");
	});

	test("shows generic not-found for distant name", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.handleCommand(["help", "xyzzy"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect((cli.lastError!.error as Error).message).toContain('Command "xyzzy" not found.');
		expect((cli.lastError!.error as Error).message).toContain("aku list");
	});

	test("shows general help message when no command given", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.handleCommand(["help"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toContainEqual({
			paragraph: "This is the command line interface for the Aku framework.",
		});
		expect(cli.output).toContainEqual({
			paragraph:
				'Try "aku list" for a list of available commands, or "aku help <command>" for help with a specific command.',
		});
	});
});
