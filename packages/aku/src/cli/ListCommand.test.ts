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

		const exitCode = await cli.handleCommand(["list"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  [
		    {
		      "h1": "Available commands",
		    },
		    {
		      "dl": {
		        "items": [
		          {
		            "definition": "Do bar things",
		            "label": "bar",
		          },
		          {
		            "definition": "Do foo things",
		            "label": "foo",
		          },
		          {
		            "definition": "List all available commands",
		            "label": "list",
		          },
		        ],
		      },
		    },
		  ]
		`);
	});

	test("is the default command when no args provided", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.handleCommand([]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  [
		    {
		      "h1": "Available commands",
		    },
		    {
		      "dl": {
		        "items": [
		          {
		            "definition": "List all available commands",
		            "label": "list",
		          },
		        ],
		      },
		    },
		  ]
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

		const exitCode = await cli.handleCommand(["list"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  [
		    {
		      "h1": "Available commands",
		    },
		    {
		      "dl": {
		        "items": [
		          {
		            "definition": "A command",
		            "label": "alpha",
		          },
		          {
		            "definition": "List all available commands",
		            "label": "list",
		          },
		          {
		            "definition": "Z command",
		            "label": "zebra",
		          },
		        ],
		      },
		    },
		  ]
		`);
	});
});
