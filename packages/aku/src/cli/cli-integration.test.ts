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

		const exitCode = await cli.handleCommand(["greet", "Alice"]);

		expect(exitCode).toBe(0);
		expect(cli.output).toContainEqual({ paragraph: "Hello, Alice!" });
	});

	test("exit code 1 for unknown command", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.handleCommand(["nonexistent"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect((cli.lastError!.error as Error).message).toContain('Command "nonexistent" not found');
	});

	test("defaults to 'list' command when no command specified", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.handleCommand([]);

		expect(exitCode).toBe(0);
		expect(cli.output).toContainEqual({ h1: "Available commands" });
	});

	test("handles CliExitError (expected errors)", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [failCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.handleCommand(["fail"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.isExpected).toBe(true);
		expect((cli.lastError!.error as Error).message).toBe("Something went wrong");
	});

	test("handles unexpected errors", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [crashCommand];
			}
		}

		const { cli } = createTestApplication({ providers: [TestProvider] });

		const exitCode = await cli.handleCommand(["crash"]);

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.isExpected).toBe(false);
		expect((cli.lastError!.error as Error).message).toBe("Unexpected boom");
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
