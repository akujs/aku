import { describe, expect, test } from "bun:test";
import { defineCommand } from "./defineCommand.ts";

describe(defineCommand, () => {
	test("accepts single-word names", () => {
		const cmd = defineCommand({
			name: "greet",
			description: "Greet someone",
			handler: async () => {},
		});
		expect(cmd.name).toBe("greet");
	});

	test("accepts two-word names", () => {
		const cmd = defineCommand({
			name: "db migrate",
			description: "Run migrations",
			handler: async () => {},
		});
		expect(cmd.name).toBe("db migrate");
	});

	test("accepts hyphenated names", () => {
		const cmd = defineCommand({
			name: "my-command",
			description: "A command",
			handler: async () => {},
		});
		expect(cmd.name).toBe("my-command");
	});

	test("accepts hyphenated two-word names", () => {
		const cmd = defineCommand({
			name: "db run-migrations",
			description: "Run migrations",
			handler: async () => {},
		});
		expect(cmd.name).toBe("db run-migrations");
	});

	test("rejects names with multiple spaces", () => {
		expect(() =>
			defineCommand({
				name: "db migrate fresh",
				description: "Too many words",
				handler: async () => {},
			}),
		).toThrow("Invalid command name");
	});

	test("rejects empty names", () => {
		expect(() =>
			defineCommand({
				name: "",
				description: "Empty name",
				handler: async () => {},
			}),
		).toThrow("Invalid command name");
	});

	test("rejects names with leading spaces", () => {
		expect(() =>
			defineCommand({
				name: " greet",
				description: "Leading space",
				handler: async () => {},
			}),
		).toThrow("Invalid command name");
	});

	test("rejects names with special characters", () => {
		expect(() =>
			defineCommand({
				name: "greet!",
				description: "Special chars",
				handler: async () => {},
			}),
		).toThrow("Invalid command name");
	});
});
