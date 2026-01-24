import { describe, expect, test } from "bun:test";
import { inject } from "../container/inject.ts";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http-test-utils.bun.ts";
import { CliExitError } from "./cli-errors.ts";
import { CliErrorHandler } from "./contracts/CliErrorHandler.ts";
import type { Terminal } from "./contracts/Terminal.ts";
import { Terminal as TerminalToken } from "./contracts/Terminal.ts";
import { MemoryCliErrorHandler } from "./MemoryCliErrorHandler.ts";
import { MemoryTerminal } from "./MemoryTerminal.ts";

describe("CLI command handling", () => {
	test("executes registered command with args", async () => {
		class GreetCommand {
			static readonly name = "greet";
			static readonly description = "Greet someone";
			async execute(args: string[], terminal: Terminal): Promise<void> {
				terminal.p(`Hello, ${args[0] ?? "world"}!`);
			}
		}

		class TestProvider extends ServiceProvider {
			override get commands() {
				return [GreetCommand];
			}
		}

		const { app } = createTestApplication({ providers: [TestProvider] });
		const terminal = new MemoryTerminal();

		const exitCode = await app.handleCommand(["greet", "Alice"], terminal);

		expect(exitCode).toBe(0);
		expect(terminal.output).toContainEqual({ paragraph: "Hello, Alice!" });
	});

	test("exit code 1 for unknown command", async () => {
		const errorHandler = new MemoryCliErrorHandler();
		const { app, container } = createTestApplication();
		container.singletonInstance(CliErrorHandler, errorHandler);
		const terminal = new MemoryTerminal();

		const exitCode = await app.handleCommand(["nonexistent"], terminal);

		expect(exitCode).toBe(1);
		expect(errorHandler.lastError).toBeDefined();
		expect((errorHandler.lastError!.error as Error).message).toContain(
			'Command "nonexistent" not found',
		);
	});

	test("defaults to 'list' command when no command specified", async () => {
		const { app } = createTestApplication();
		const terminal = new MemoryTerminal();

		const exitCode = await app.handleCommand([], terminal);

		expect(exitCode).toBe(0);
		expect(terminal.output).toContainEqual({ h1: "Available commands" });
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
		const terminal = new MemoryTerminal();

		const exitCode = await app.handleCommand(["fail"], terminal);

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
		const terminal = new MemoryTerminal();

		const exitCode = await app.handleCommand(["crash"], terminal);

		expect(exitCode).toBe(1);
		expect(errorHandler.lastError).toBeDefined();
		expect(errorHandler.lastError!.isExpected).toBe(false);
		expect((errorHandler.lastError!.error as Error).message).toBe("Unexpected boom");
	});

	test("Terminal is available via DI during command execution", async () => {
		let injectedTerminal: Terminal | null = null;

		class InjectCommand {
			static readonly name = "inject-test";
			static readonly description = "Test terminal injection";

			#terminal: Terminal;

			constructor(terminal: Terminal = inject(TerminalToken)) {
				this.#terminal = terminal;
			}

			async execute(_args: string[], terminalArg: Terminal): Promise<void> {
				injectedTerminal = this.#terminal;
				terminalArg.p("done");
			}
		}

		class TestProvider extends ServiceProvider {
			override get commands() {
				return [InjectCommand];
			}
		}

		const { app } = createTestApplication({ providers: [TestProvider] });
		const terminal = new MemoryTerminal();

		const exitCode = await app.handleCommand(["inject-test"], terminal);

		expect(exitCode).toBe(0);
		expect(injectedTerminal === terminal).toBe(true);
	});

	test("throws when app is not bootstrapped", async () => {
		const terminal = new MemoryTerminal();

		// Create a new app that hasn't been bootstrapped
		const { ApplicationImpl } = await import("../core/ApplicationImpl.ts");
		const unbootedApp = new ApplicationImpl();

		expect(() => unbootedApp.handleCommand(["test"], terminal)).toThrow(
			"Application must be bootstrapped",
		);
	});
});
