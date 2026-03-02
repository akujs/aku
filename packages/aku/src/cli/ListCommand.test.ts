import { describe, expect, test } from "bun:test";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http.test-utils.ts";
import { defineCommand } from "./defineCommand.ts";
import { listCommand } from "./ListCommand.ts";

const fooCommand = defineCommand({
	name: "foo",
	description: "Do foo things",
	handler: async () => {},
});

const barCommand = defineCommand({
	name: "bar",
	description: "Do bar things",
	handler: async () => {},
});

class TestCommandProvider extends ServiceProvider {
	override get commands() {
		return [fooCommand, barCommand];
	}
}

describe(listCommand.handler, () => {
	test("displays title and command list", async () => {
		const { cli } = createTestApplication({
			providers: [TestCommandProvider],
		});

		const exitCode = await cli.run(["list"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AVAILABLE COMMANDS

		  bar: Do bar things
		  completions: Get tab completion for aku commands in your shell
		  foo: Do foo things
		  help: Show help for a command
		  list: List all available commands"
		`);
	});

	test("is the default command when no args provided", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run([]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AVAILABLE COMMANDS

		  completions: Get tab completion for aku commands in your shell
		  help: Show help for a command
		  list: List all available commands"
		`);
	});

	test("hidden commands are not listed", async () => {
		const hiddenCommand = defineCommand({
			name: "secret",
			description: "A secret command",
			hidden: true,
			handler: async () => {},
		});

		class HiddenTestProvider extends ServiceProvider {
			override get commands() {
				return [fooCommand, hiddenCommand];
			}
		}

		const { cli } = createTestApplication({
			providers: [HiddenTestProvider],
		});

		const exitCode = await cli.run(["list"]);

		expect(exitCode).toBe(0);
		expect(cli.output).not.toContain("secret");
		expect(cli.output).toContain("foo");
	});

	test("--format json outputs compact JSON", async () => {
		const { cli } = createTestApplication({
			providers: [TestCommandProvider],
		});

		const exitCode = await cli.run(["list", "--format", "json"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(
			`"{"commands":[{"command":"bar","description":"Do bar things"},{"command":"completions","description":"Get tab completion for aku commands in your shell"},{"command":"foo","description":"Do foo things"},{"command":"help","description":"Show help for a command"},{"command":"list","description":"List all available commands"}]}"`,
		);
	});

	test("--format json --pretty outputs indented JSON", async () => {
		const { cli } = createTestApplication({
			providers: [TestCommandProvider],
		});

		const exitCode = await cli.run(["list", "--format", "json", "--pretty"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "{
		      "commands": [
		          {
		              "command": "bar",
		              "description": "Do bar things"
		          },
		          {
		              "command": "completions",
		              "description": "Get tab completion for aku commands in your shell"
		          },
		          {
		              "command": "foo",
		              "description": "Do foo things"
		          },
		          {
		              "command": "help",
		              "description": "Show help for a command"
		          },
		          {
		              "command": "list",
		              "description": "List all available commands"
		          }
		      ]
		  }"
		`);
	});

	test("--format toon outputs TOON format", async () => {
		const { cli } = createTestApplication({
			providers: [TestCommandProvider],
		});

		const exitCode = await cli.run(["list", "--format", "toon"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "commands[5]{command,description}:
		    bar,Do bar things
		    completions,Get tab completion for aku commands in your shell
		    foo,Do foo things
		    help,Show help for a command
		    list,List all available commands"
		`);
	});

	test("--format toon --pretty produces same output as --format toon", async () => {
		const { cli: cli1 } = createTestApplication({
			providers: [TestCommandProvider],
		});
		const { cli: cli2 } = createTestApplication({
			providers: [TestCommandProvider],
		});

		await cli1.run(["list", "--format", "toon"]);
		await cli2.run(["list", "--format", "toon", "--pretty"]);

		expect(cli1.output).toBe(cli2.output);
	});

	test("--format with invalid value produces an error", async () => {
		const { cli } = createTestApplication({
			providers: [TestCommandProvider],
		});

		const exitCode = await cli.run(["list", "--format", "invalid"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.isExpected).toBe(true);
		expect(cli.lastError!.error.message).toBe(
			'Unknown format: "invalid". Supported formats: json, toon',
		);
	});

	test("commands are listed in alphabetical order", async () => {
		const zebraCommand = defineCommand({
			name: "zebra",
			description: "Z command",
			handler: async () => {},
		});
		const alphaCommand = defineCommand({
			name: "alpha",
			description: "A command",
			handler: async () => {},
		});

		class OrderTestProvider extends ServiceProvider {
			override get commands() {
				return [zebraCommand, alphaCommand];
			}
		}

		const { cli } = createTestApplication({
			providers: [OrderTestProvider],
		});

		const exitCode = await cli.run(["list"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AVAILABLE COMMANDS

		  alpha: A command
		  completions: Get tab completion for aku commands in your shell
		  help: Show help for a command
		  list: List all available commands
		  zebra: Z command"
		`);
	});
});
