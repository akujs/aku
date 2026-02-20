import { describe, expect, test } from "bun:test";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http-test-utils.bun.ts";
import { ListCommand } from "./ListCommand.ts";
import { MemoryCliApi } from "./MemoryCliApi.ts";

class FooCommand {
	static readonly name = "foo";
	static readonly description = "Do foo things";
	async execute(): Promise<void> {}
}

class BarCommand {
	static readonly name = "bar";
	static readonly description = "Do bar things";
	async execute(): Promise<void> {}
}

class TestCommandProvider extends ServiceProvider {
	override get commands() {
		return [FooCommand, BarCommand];
	}
}

describe(ListCommand, () => {
	test("displays title and command list", async () => {
		const { app } = createTestApplication({
			providers: [TestCommandProvider],
		});
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["list"], cli);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchSnapshot();
	});

	test("is the default command when no args provided", async () => {
		const { app } = createTestApplication();
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand([], cli);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchSnapshot();
	});

	test("commands are listed in alphabetical order", async () => {
		class ZCommand {
			static readonly name = "zebra";
			static readonly description = "Z command";
			async execute(): Promise<void> {}
		}
		class ACommand {
			static readonly name = "alpha";
			static readonly description = "A command";
			async execute(): Promise<void> {}
		}

		class OrderTestProvider extends ServiceProvider {
			override get commands() {
				return [ZCommand, ACommand];
			}
		}

		const { app } = createTestApplication({
			providers: [OrderTestProvider],
		});
		const cli = new MemoryCliApi();

		const exitCode = await app.handleCommand(["list"], cli);

		expect(exitCode).toBe(0);
		expect(cli.output).toMatchSnapshot();
	});
});
