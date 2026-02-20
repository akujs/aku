import { describe, expect, test } from "bun:test";
import { inject } from "../container/inject.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http-test-utils.bun.ts";
import { CliExitError } from "./cli-errors.ts";
import type { ArgumentSchema, CommandArgs, CommandExecuteContext } from "./cli-types.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import { CliApi as CliApiToken } from "./contracts/CliApi.ts";
import { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import { MemoryCliApi } from "./MemoryCliApi.ts";
import { MemoryCliErrorHandler } from "./MemoryCliErrorHandler.ts";

describe("CLI command handling", () => {
	test("executes registered command with args", async () => {
		class GreetCommand {
			static readonly name = "greet";
			static readonly description = "Greet someone";
			static readonly args = {
				name: { type: "string", positional: true, description: "Name to greet" },
			} as const satisfies ArgumentSchema;
			async execute({
				args,
				cli,
			}: CommandExecuteContext<CommandArgs<typeof GreetCommand>>): Promise<void> {
				cli.p(`Hello, ${args.name ?? "world"}!`);
			}
		}

		class TestProvider extends ServiceProvider {
			override get commands() {
				return [GreetCommand];
			}
		}

		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["greet", "Alice"], cli);

		expect(exitCode).toBe(0);
		expect(cli.output).toContainEqual({ paragraph: "Hello, Alice!" });
	});

	test("exit code 1 for unknown command", async () => {
		const errorHandler = new MemoryCliErrorHandler();
		const { app, container } = createTestApplication();
		container.singletonInstance(CliErrorHandler, errorHandler);
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
		class FailCommand {
			static readonly name = "fail";
			static readonly description = "A command that fails";
			async execute(): Promise<void> {
				throw new CliExitError("Something went wrong");
			}
		}

		class TestProvider extends ServiceProvider {
			override get commands() {
				return [FailCommand];
			}
		}

		const errorHandler = new MemoryCliErrorHandler();
		const { app, container } = createTestApplication({ providers: [TestProvider] });
		container.singletonInstance(CliErrorHandler, errorHandler);
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["fail"], cli);

		expect(exitCode).toBe(1);
		expect(errorHandler.lastError).toBeDefined();
		expect(errorHandler.lastError!.isExpected).toBe(true);
		expect((errorHandler.lastError!.error as Error).message).toBe("Something went wrong");
	});

	test("handles unexpected errors", async () => {
		class CrashCommand {
			static readonly name = "crash";
			static readonly description = "A command that crashes";
			async execute(): Promise<void> {
				throw new Error("Unexpected boom");
			}
		}

		class TestProvider extends ServiceProvider {
			override get commands() {
				return [CrashCommand];
			}
		}

		const errorHandler = new MemoryCliErrorHandler();
		const { app, container } = createTestApplication({ providers: [TestProvider] });
		container.singletonInstance(CliErrorHandler, errorHandler);
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["crash"], cli);

		expect(exitCode).toBe(1);
		expect(errorHandler.lastError).toBeDefined();
		expect(errorHandler.lastError!.isExpected).toBe(false);
		expect((errorHandler.lastError!.error as Error).message).toBe("Unexpected boom");
	});

	test("CliApi is available via DI during command execution", async () => {
		let injectedCli: CliApi | null = null;

		class InjectCommand {
			static readonly name = "inject-test";
			static readonly description = "Test CLI injection";

			#cli: CliApi;

			constructor(cli: CliApi = inject(CliApiToken)) {
				this.#cli = cli;
			}

			async execute({ cli }: CommandExecuteContext): Promise<void> {
				injectedCli = this.#cli;
				cli.p("done");
			}
		}

		class TestProvider extends ServiceProvider {
			override get commands() {
				return [InjectCommand];
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
