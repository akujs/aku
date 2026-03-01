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

		  help: Show help for a command
		  list: List all available commands"
		`);
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
		  help: Show help for a command
		  list: List all available commands
		  zebra: Z command"
		`);
	});
});
