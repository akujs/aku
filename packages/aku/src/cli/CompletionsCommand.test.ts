import { describe, expect, test } from "bun:test";
import { createTestApplication } from "../testing/create-test-application.ts";
import { completionsCommand } from "./CompletionsCommand.ts";

describe(completionsCommand.handler, () => {
	test("bash output references ~/.bashrc", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run("completions bash");

		expect(exitCode).toBe(0);
		expect(cli.output).toContain("~/.bashrc");
	});

	test("zsh output references ~/.zshrc", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run("completions zsh");

		expect(exitCode).toBe(0);
		expect(cli.output).toContain("~/.zshrc");
	});

	test("fish output references ~/.config/fish/config.fish", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run("completions fish");

		expect(exitCode).toBe(0);
		expect(cli.output).toContain("~/.config/fish/config.fish");
	});

	test("unsupported shell produces an error", async () => {
		const { cli } = createTestApplication();

		const exitCode = await cli.run("completions powershell");

		expect(exitCode).toBe(1);
		expect(cli.lastError).toBeDefined();
		expect(cli.lastError!.error.message).toContain('Unsupported shell: "powershell"');
	});
});
