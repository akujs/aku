import { describe, expect, test } from "bun:test";
import { inject } from "../container/inject.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http.test-utils.ts";
import { BaseCommand } from "./Command.ts";
import { CliExitError } from "./cli-errors.ts";
import type { ArgumentSchema, CommandExecuteContext, InferArgs } from "./cli-types.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import { CliApi as CliApiToken } from "./contracts/CliApi.ts";
import { defineCommand } from "./defineCommand.ts";
import { MemoryCliApi } from "./MemoryCliApi.ts";

const greetArgs = {
	name: { type: "string", positional: true, description: "Name to greet" },
} as const satisfies ArgumentSchema;

const greetCommand = defineCommand({
	name: "greet",
	description: "Greet someone",
	args: greetArgs,
	handler: async ({ args, cli }: CommandExecuteContext<InferArgs<typeof greetArgs>>) => {
		cli.p(`Hello, ${args.name ?? "world"}!`);
	},
});

const failCommand = defineCommand({
	name: "fail",
	description: "A command that fails",
	handler: async () => {
		throw new CliExitError("Something went wrong");
	},
});

const crashCommand = defineCommand({
	name: "crash",
	description: "A command that crashes",
	handler: async () => {
		throw new Error("Unexpected boom");
	},
});

class InjectCommandHandler extends BaseCommand {
	#cli: CliApi;

	constructor(cli: CliApi = inject(CliApiToken)) {
		super();
		this.#cli = cli;
	}

	async execute({ cli }: CommandExecuteContext): Promise<void> {
		injectedCli = this.#cli;
		cli.p("done");
	}
}

let injectedCli: CliApi | null = null;

const injectTestCommand = defineCommand({
	name: "inject-test",
	description: "Test CLI injection",
	handler: InjectCommandHandler,
});

describe("CLI command handling", () => {
	test("executes registered command with args", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [greetCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["greet", "Alice"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toBe("Hello, Alice!");
	});

	test("exit code 1 for unknown command", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run(["nonexistent"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.error.message).toContain('Command "nonexistent" not found');
	});

	test("defaults to 'list' command when no command specified", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run([]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AVAILABLE COMMANDS

		  help: Show help for a command
		  list: List all available commands"
		`);
	});

	test("handles CliExitError (expected errors)", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [failCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["fail"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.isExpected).toBe(true);
		expect(cli.lastError!.error.message).toBe("Something went wrong");
	});

	test("handles unexpected errors", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [crashCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["crash"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.isExpected).toBe(false);
		expect(cli.lastError!.error.message).toBe("Unexpected boom");
	});

	test("CliApi is available via DI during command execution", async () => {
		injectedCli = null;

		class TestProvider extends ServiceProvider {
			override get commands() {
				return [injectTestCommand];
			}
		}

		const { app } = createTestApplication({ providers: [TestProvider] });
		const memoryCli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["inject-test"], memoryCli);

		expect(exitCode).toBe(0);
		expect(injectedCli === memoryCli).toBe(true);
	});

	test("throws when app is not bootstrapped", async () => {
		const memoryCli = new MemoryCliApi();

		// Create a new app that hasn't been bootstrapped
		const { ApplicationImpl } = await import("../core/ApplicationImpl.ts");
		const unbootedApp = new ApplicationImpl();

		expect(() => unbootedApp.handleCommand(["test"], memoryCli)).toThrow(
			"Application must be bootstrapped",
		);
	});
});

const requiredArgCommand = defineCommand({
	name: "compile",
	description: "Compile a file",
	args: {
		file: {
			type: "string",
			positional: true,
			required: true,
			description: "The file to compile",
		},
	} as const satisfies ArgumentSchema,
	handler: async () => {},
});

describe("--help flag handling", () => {
	test("--help flag rewrites to help command", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [greetCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["greet", "--help"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AKU GREET

		  Greet someone

		  ## Usage

		    aku greet [name]

		  ## Arguments

		  [name]: Name to greet (optional)"
		`);
	});

	test("--help with other args still shows help", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [greetCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["greet", "--help", "Alice"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AKU GREET

		  Greet someone

		  ## Usage

		    aku greet [name]

		  ## Arguments

		  [name]: Name to greet (optional)"
		`);
	});

	test("--help with no command shows general help message", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run(["--help"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchInlineSnapshot(`
		  "This is the command line interface for the Aku framework.

		  Try "aku list" for a list of available commands, or "aku help <command>" for help with a specific command."
		`);
	});
});

describe("help on validation failure", () => {
	test("shows help output on validation failure for missing required arg", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [requiredArgCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["compile"]);

		expect(exitCode).toBe(1);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AKU COMPILE

		  Compile a file

		  ## Usage

		    aku compile <file>

		  ## Arguments

		  <file>: The file to compile (required)"
		`);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.error.message).toContain("Missing required argument: file");
	});

	test("shows help output on validation failure for unknown option", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [requiredArgCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.run(["compile", "main.ts", "--unknown"]);

		expect(exitCode).toBe(1);
		expect(cli.output).toMatchInlineSnapshot(`
		  "# AKU COMPILE

		  Compile a file

		  ## Usage

		    aku compile <file>

		  ## Arguments

		  <file>: The file to compile (required)"
		`);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.error.message).toContain("Unknown option: --unknown");
	});
});
