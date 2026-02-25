import { describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { CommandHandler } from "./CommandHandler.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import type { CliExitError } from "./cli-errors.ts";
import { MemoryCliApi } from "./MemoryCliApi.ts";

function createHandler(commandNames: string[]) {
	const container = new ContainerImpl();
	const registry = new CommandRegistry(container);
	for (const name of commandNames) {
		registry.register({
			name,
			description: `The ${name} command`,
			async execute() {},
		} as never);
	}
	const errorHandler = new MemoryCliApi();
	const handler = new CommandHandler(registry, errorHandler);
	return { handler, errorHandler };
}

describe(CommandHandler, () => {
	test("suggests similar commands for a typo", async () => {
		const { handler, errorHandler } = createHandler(["migrate", "serve", "list", "build"]);
		const cli = new MemoryCliApi();

		await handler.handle(["migrat"], cli);

		const error = errorHandler.lastError!.error as CliExitError;
		expect(error.message).toMatchInlineSnapshot(`
		  "Command "migrat" not found.

		  Did you mean:
		    migrate

		  Run "aku list" to see available commands."
		`);
	});

	test("suggests multiple commands sorted by distance", async () => {
		const { handler, errorHandler } = createHandler(["serve", "server", "sever", "build"]);
		const cli = new MemoryCliApi();

		await handler.handle(["serv"], cli);

		const error = errorHandler.lastError!.error as CliExitError;
		expect(error.message).toMatchInlineSnapshot(`
		  "Command "serv" not found.

		  Did you mean:
		    serve
		    server
		    sever

		  Run "aku list" to see available commands."
		`);
	});

	test("shows no suggestions when nothing is similar", async () => {
		const { handler, errorHandler } = createHandler(["migrate", "serve", "list"]);
		const cli = new MemoryCliApi();

		await handler.handle(["zzzzzzz"], cli);

		const error = errorHandler.lastError!.error as CliExitError;
		expect(error.message).toMatchInlineSnapshot(`
		  "Command "zzzzzzz" not found.

		  Run "aku list" to see available commands."
		`);
	});
});
