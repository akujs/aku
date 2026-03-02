import { describe, expect, test } from "bun:test";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http.test-utils.ts";
import type { ArgumentSchema, CommandGroupDefinition } from "./cli-types.ts";
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

const dbMigrateCommand = defineCommand({
	name: "db migrate",
	description: "Run database migrations",
	args: {
		fresh: { type: "boolean", description: "Drop all tables first" },
	} as const satisfies ArgumentSchema,
	handler: async () => {},
});

class TestProvider extends ServiceProvider {
	override get commands() {
		return [greetCommand, simpleCommand];
	}
}

class GroupedTestProvider extends ServiceProvider {
	override get commandGroups(): CommandGroupDefinition[] {
		return [{ name: "db", description: "Database commands" }];
	}

	override get commands() {
		return [greetCommand, dbMigrateCommand];
	}
}

describe(helpCommand.handler, () => {
	test("displays help for a known command with args", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["help", "greet"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AKU GREET

		  Greet someone by name

		  ## Usage

		    aku greet <name> [options]

		  ## Arguments

		  <name>: The person to greet (required)

		  ## Options

		  --verbose: Enable verbose output (optional)"
		`);
	});

	test("displays help for a command with no args", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run("help simple");

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AKU SIMPLE

		  A command with no args

		  ## Usage

		    aku simple"
		`);
	});

	test("shows 'did you mean' for close misspelling", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["help", "gret"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.error.message).toContain('Command "gret" not found.');
		expect(cli.lastError!.error.message).toContain("Did you mean");
		expect(cli.lastError!.error.message).toContain("greet");
	});

	test("shows generic not-found for distant name", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["help", "xyzzy"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.error.message).toContain('Command "xyzzy" not found.');
		expect(cli.lastError!.error.message).toContain("aku list");
	});

	test("shows general help message when no command given", async () => {
		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["help"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "This is the command line interface for the Aku framework.

		  Try "aku list" for a list of available commands, or "aku help <command>" for help with a specific command."
		`);
	});

	test("displays help for a two-word command", async () => {
		const { cli } = createTestApplication({ providers: [GroupedTestProvider] });

		const exitCode = await cli.run(["help", "db", "migrate"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AKU DB MIGRATE

		  Run database migrations

		  ## Usage

		    aku db migrate [options]

		  ## Options

		  --fresh: Drop all tables first (optional)"
		`);
	});

	test("help with group name delegates to list", async () => {
		const { cli } = createTestApplication({ providers: [GroupedTestProvider] });

		const exitCode = await cli.run(["help", "db"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# DATABASE COMMANDS

		  migrate: Run database migrations"
		`);
	});
});
