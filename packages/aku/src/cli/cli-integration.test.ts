import { describe, expect, test } from "bun:test";
import { inject } from "../container/inject.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http-test-utils.bun.ts";
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

		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["greet", "Alice"], cli);

		expect(exitCode).toBe(0);
		expect(cli.output).toContainEqual({ paragraph: "Hello, Alice!" });
	});

	test("exit code 1 for unknown command", async () => {
		const { app, errorHandler } = createTestApplication();
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["nonexistent"], cli);

		expect(exitCode).toBe(1);
		expect(errorHandler.lastError).toBeDefined();
		expect((errorHandler.lastError!.error as Error).message).toContain(
			'Command "nonexistent" not found',
		);
	});

	test("defaults to 'list' command when no command specified", async () => {
		const { app } = createTestApplication();
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand([], cli);

		expect(exitCode).toBe(0);
		expect(cli.output).toContainEqual({ h1: "Available commands" });
	});

	test("handles CliExitError (expected errors)", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [failCommand];
			}
		}

		const { app, errorHandler } = createTestApplication({ providers: [TestProvider] });
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["fail"], cli);

		expect(exitCode).toBe(1);
		expect(errorHandler.lastError).toBeDefined();
		expect(errorHandler.lastError!.isExpected).toBe(true);
		expect((errorHandler.lastError!.error as Error).message).toBe("Something went wrong");
	});

	test("handles unexpected errors", async () => {
		class TestProvider extends ServiceProvider {
			override get commands() {
				return [crashCommand];
			}
		}

		const { app, errorHandler } = createTestApplication({ providers: [TestProvider] });
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["crash"], cli);

		expect(exitCode).toBe(1);
		expect(errorHandler.lastError).toBeDefined();
		expect(errorHandler.lastError!.isExpected).toBe(false);
		expect((errorHandler.lastError!.error as Error).message).toBe("Unexpected boom");
	});

	test("CliApi is available via DI during command execution", async () => {
		injectedCli = null;

		class TestProvider extends ServiceProvider {
			override get commands() {
				return [injectTestCommand];
			}
		}

		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["inject-test"], cli);

		expect(exitCode).toBe(0);
		expect(injectedCli === cli).toBe(true);
	});

	test("throws when app is not bootstrapped", async () => {
		const cli = new MemoryCliApi();

		// Create a new app that hasn't been bootstrapped
		const { ApplicationImpl } = await import("../core/ApplicationImpl.ts");
		const unbootedApp = new ApplicationImpl();

		expect(() => unbootedApp.handleCommand(["test"], cli)).toThrow(
			"Application must be bootstrapped",
		);
	});
});
