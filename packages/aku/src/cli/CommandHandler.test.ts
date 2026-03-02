import { describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { CommandHandler } from "./CommandHandler.ts";
import { CommandRegistry } from "./CommandRegistry.ts";

import type { CommandDefinition } from "./cli-types.ts";
import { MemoryCliApi } from "./MemoryCliApi.ts";

function createHandler(commands: (string | CommandDefinition)[]) {
	const container = new ContainerImpl();
	const registry = new CommandRegistry(container);
	for (const cmd of commands) {
		if (typeof cmd === "string") {
			registry.register({
				name: cmd,
				description: `The ${cmd} command`,
				async execute() {},
			} as never);
		} else {
			registry.register(cmd);
		}
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

		const error = errorHandler.lastError!.error;
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

		const error = errorHandler.lastError!.error;
		expect(error.message).toMatchInlineSnapshot(`
		  "Command "serv" not found.

		  Did you mean:
		    serve
		    server
		    sever

		  Run "aku list" to see available commands."
		`);
	});

	test("excludes hidden commands from suggestions", async () => {
		const { handler, errorHandler } = createHandler([
			"migrate",
			"serve",
			"list",
			"build",
			{
				name: "migrator",
				description: "Hidden migrator command",
				hidden: true,
				handler: async () => {},
			},
		]);
		const cli = new MemoryCliApi();

		await handler.handle(["migrato"], cli);

		const error = errorHandler.lastError!.error;
		expect(error.message).toContain("migrate");
		expect(error.message).not.toContain("migrator");
	});

	test("shows no suggestions when nothing is similar", async () => {
		const { handler, errorHandler } = createHandler(["migrate", "serve", "list"]);
		const cli = new MemoryCliApi();

		await handler.handle(["zzzzzzz"], cli);

		const error = errorHandler.lastError!.error;
		expect(error.message).toMatchInlineSnapshot(`
		  "Command "zzzzzzz" not found.

		  Run "aku list" to see available commands."
		`);
	});
});
