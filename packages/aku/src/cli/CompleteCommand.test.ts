import { describe, expect, test } from "bun:test";
import { ContainerImpl } from "../container/ContainerImpl.ts";
import { CommandRegistry } from "./CommandRegistry.ts";
import { getCompletions } from "./CompleteCommand.ts";
import type { ArgumentSchema } from "./cli-types.ts";
import { defineCommand } from "./defineCommand.ts";

function createRegistry(
	commands: Array<{
		name: string;
		description?: string | undefined;
		hidden?: boolean | undefined;
		args?: ArgumentSchema | undefined;
	}>,
): CommandRegistry {
	const container = new ContainerImpl();
	const registry = new CommandRegistry(container);
	for (const cmd of commands) {
		registry.register(
			defineCommand({
				name: cmd.name,
				description: cmd.description ?? `The ${cmd.name} command`,
				hidden: cmd.hidden,
				args: cmd.args ?? {},
				handler: async () => {},
			}),
		);
	}
	return registry;
}

function complete(registry: CommandRegistry, line: string, point?: number): string[] {
	return getCompletions(line, point ?? line.length, registry);
}

describe(getCompletions, () => {
	const registry = createRegistry([
		{ name: "migrate" },
		{ name: "serve" },
		{ name: "list" },
		{ name: "build" },
	]);

	test("completes command names with empty prefix", () => {
		const result = complete(registry, "aku ");
		expect(result).toEqual(["build", "list", "migrate", "serve"]);
	});

	test("completes command names with prefix", () => {
		const result = complete(registry, "aku mi");
		expect(result).toEqual(["migrate"]);
	});

	test("completes command names matching multiple", () => {
		const reg = createRegistry([{ name: "serve" }, { name: "server" }, { name: "set" }]);
		const result = complete(reg, "aku ser");
		expect(result).toEqual(["serve", "server"]);
	});

	test("returns empty for no matching commands", () => {
		const result = complete(registry, "aku zzz");
		expect(result).toEqual([]);
	});

	test("hidden commands are excluded from completions", () => {
		const reg = createRegistry([{ name: "migrate" }, { name: "secret", hidden: true }]);
		const result = complete(reg, "aku ");
		expect(result).toEqual(["migrate"]);
	});

	test("hidden grouped commands do not surface their group name", () => {
		const reg = createRegistry([
			{ name: "db migrate", hidden: true },
			{ name: "db seed", hidden: true },
			{ name: "serve" },
		]);
		const result = complete(reg, "aku ");
		expect(result).toEqual(["serve"]);
	});

	test("completes flags for a known command", () => {
		const reg = createRegistry([
			{
				name: "serve",
				args: {
					port: { type: "number", description: "Port to serve on" },
					host: { type: "string", description: "Host to bind to" },
					verbose: { type: "boolean", description: "Verbose output" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku serve --");
		expect(result).toEqual(["--host=", "--port=", "--verbose"]);
	});

	test("completes flags with partial prefix", () => {
		const reg = createRegistry([
			{
				name: "serve",
				args: {
					port: { type: "number" },
					host: { type: "string" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku serve --p");
		expect(result).toEqual(["--port="]);
	});

	test("does not complete flags for unknown command", () => {
		const result = complete(registry, "aku unknown --");
		expect(result).toEqual([]);
	});

	test("does not complete flags for command without args", () => {
		const reg = createRegistry([{ name: "noop" }]);
		const result = complete(reg, "aku noop --");
		expect(result).toEqual([]);
	});

	test("uses cursor position to determine partial word", () => {
		// Cursor is at position 6, in "aku mi|grate" — should complete "mi"
		const result = complete(registry, "aku migrate", 6);
		expect(result).toEqual(["migrate"]);
	});

	test("converts camelCase args to kebab-case flags", () => {
		const reg = createRegistry([
			{
				name: "build",
				args: {
					outputDir: { type: "string" },
					noCache: { type: "boolean" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku build --");
		expect(result).toEqual(["--no-cache", "--output-dir="]);
	});

	test("excludes positional args from flag completions", () => {
		const reg = createRegistry([
			{
				name: "compile",
				args: {
					file: { type: "string", positional: true },
					optimize: { type: "boolean" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku compile --");
		expect(result).toEqual(["--optimize"]);
	});

	test("completes group names alongside ungrouped commands", () => {
		const reg = createRegistry([{ name: "serve" }, { name: "db migrate" }, { name: "db seed" }]);
		const result = complete(reg, "aku ");
		expect(result).toEqual(["db", "serve"]);
	});

	test("completes subcommands within a group", () => {
		const reg = createRegistry([
			{ name: "db migrate" },
			{ name: "db seed" },
			{ name: "db status" },
		]);
		const result = complete(reg, "aku db ");
		expect(result).toEqual(["migrate", "seed", "status"]);
	});

	test("completes subcommands with partial prefix", () => {
		const reg = createRegistry([{ name: "db migrate" }, { name: "db seed" }]);
		const result = complete(reg, "aku db m");
		expect(result).toEqual(["migrate"]);
	});

	test("completes flags for a grouped command", () => {
		const reg = createRegistry([
			{
				name: "db migrate",
				args: {
					fresh: { type: "boolean" },
					seed: { type: "boolean" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku db migrate --");
		expect(result).toEqual(["--fresh", "--seed"]);
	});

	test("completes group name with prefix", () => {
		const reg = createRegistry([{ name: "serve" }, { name: "db migrate" }]);
		const result = complete(reg, "aku d");
		expect(result).toEqual(["db"]);
	});

	test("completes flags without -- prefix", () => {
		const reg = createRegistry([
			{
				name: "serve",
				args: {
					port: { type: "number", description: "Port to serve on" },
					host: { type: "string", description: "Host to bind to" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku serve ");
		expect(result).toEqual(["--host=", "--port="]);
	});

	test("completes flags after a positional arg value", () => {
		const reg = createRegistry([
			{
				name: "build",
				args: {
					file: { type: "string", positional: true },
					optimize: { type: "boolean" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku build somefile ");
		expect(result).toEqual(["--optimize"]);
	});

	test("help completes command and group names", () => {
		const reg = createRegistry([
			{ name: "help", args: { command: { type: "string", positional: true, array: true } } },
			{ name: "serve" },
			{ name: "db migrate" },
			{ name: "db seed" },
		]);
		const result = complete(reg, "aku help ");
		expect(result).toEqual(["db", "help", "serve"]);
	});

	test("help completes command names with prefix", () => {
		const reg = createRegistry([
			{ name: "help", args: { command: { type: "string", positional: true, array: true } } },
			{ name: "serve" },
			{ name: "build" },
		]);
		const result = complete(reg, "aku help s");
		expect(result).toEqual(["serve"]);
	});

	test("list completes group names", () => {
		const reg = createRegistry([
			{
				name: "list",
				args: { group: { type: "string", positional: true } },
			},
			{ name: "serve" },
			{ name: "db migrate" },
			{ name: "db seed" },
			{ name: "cache clear" },
		]);
		const result = complete(reg, "aku list ");
		expect(result).toEqual(["cache", "db"]);
	});

	test("list completes group names with prefix", () => {
		const reg = createRegistry([
			{
				name: "list",
				args: { group: { type: "string", positional: true } },
			},
			{ name: "db migrate" },
			{ name: "cache clear" },
		]);
		const result = complete(reg, "aku list d");
		expect(result).toEqual(["db"]);
	});

	test("excludes already-provided non-array flags", () => {
		const reg = createRegistry([
			{
				name: "serve",
				args: {
					port: { type: "number" },
					host: { type: "string" },
					verbose: { type: "boolean" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku serve --port 8080 --");
		expect(result).toEqual(["--host=", "--verbose"]);
	});

	test("excludes already-provided flags using = syntax", () => {
		const reg = createRegistry([
			{
				name: "serve",
				args: {
					port: { type: "number" },
					host: { type: "string" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku serve --port=8080 --");
		expect(result).toEqual(["--host="]);
	});

	test("still offers array flags that are already provided", () => {
		const reg = createRegistry([
			{
				name: "build",
				args: {
					include: { type: "string", array: true },
					verbose: { type: "boolean" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku build --include foo --");
		expect(result).toEqual(["--include=", "--verbose"]);
	});

	test("excludes already-provided flags for grouped commands", () => {
		const reg = createRegistry([
			{
				name: "db migrate",
				args: {
					fresh: { type: "boolean" },
					seed: { type: "boolean" },
				} as const satisfies ArgumentSchema,
			},
		]);
		const result = complete(reg, "aku db migrate --fresh --");
		expect(result).toEqual(["--seed"]);
	});
});
