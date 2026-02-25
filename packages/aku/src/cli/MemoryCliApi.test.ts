import { describe, expect, test } from "bun:test";
import { MemoryCliApi } from "./MemoryCliApi.ts";

describe(MemoryCliApi, () => {
	test("nextPrompt returns a pending select prompt", async () => {
		const cli = new MemoryCliApi();

		const selectPromise = cli.select({
			prompt: "Pick a colour",
			options: [
				{ label: "Red", value: "red" },
				{ label: "Blue", value: "blue" },
			],
		});

		const prompt = await cli.nextPrompt();

		expect(prompt.type).toBe("select");
		expect(prompt.options).toEqual({
			prompt: "Pick a colour",
			options: [
				{ label: "Red", value: "red" },
				{ label: "Blue", value: "blue" },
			],
		});

		prompt.respond({ success: true, value: "red" });

		const result = await selectPromise;
		expect(result).toEqual({ success: true, value: "red" });
	});

	test("nextPrompt returns a pending input prompt", async () => {
		const cli = new MemoryCliApi();

		const inputPromise = cli.input({ prompt: "Enter your name", required: true });

		const prompt = await cli.nextPrompt();

		expect(prompt.type).toBe("input");
		expect(prompt.options).toEqual({ prompt: "Enter your name", required: true });

		prompt.respond({ success: true, value: "Alice" });

		const result = await inputPromise;
		expect(result).toEqual({ success: true, value: "Alice" });
	});

	test("nextPrompt returns a pending confirm prompt", async () => {
		const cli = new MemoryCliApi();

		const confirmPromise = cli.confirm({ prompt: "Are you sure?", defaultValue: false });

		const prompt = await cli.nextPrompt();

		expect(prompt.type).toBe("confirm");
		expect(prompt.options).toEqual({ prompt: "Are you sure?", defaultValue: false });

		prompt.respond({ success: true, value: true });

		const result = await confirmPromise;
		expect(result).toEqual({ success: true, value: true });
	});

	test("respond with success: false simulates cancellation", async () => {
		const cli = new MemoryCliApi();

		const selectPromise = cli.select({
			prompt: "Pick one",
			options: [{ label: "A", value: "a" }],
		});

		const prompt = await cli.nextPrompt();
		prompt.respond({ success: false });

		const result = await selectPromise;
		expect(result).toEqual({ success: false });
	});

	test("times out if no prompt arrives", async () => {
		const cli = new MemoryCliApi();

		expect(cli.nextPrompt({ timeout: 50 })).rejects.toThrow(
			"Timed out after 50ms waiting for a prompt",
		);
	});

	test("sequential prompts work", async () => {
		const cli = new MemoryCliApi();

		const commandPromise = (async () => {
			const r1 = await cli.select({
				prompt: "First?",
				options: [{ label: "A", value: "a" }],
			});
			const r2 = await cli.input({ prompt: "Second?" });
			return [r1, r2];
		})();

		const p1 = await cli.nextPrompt();
		expect(p1.type).toBe("select");
		p1.respond({ success: true, value: "a" });

		const p2 = await cli.nextPrompt();
		expect(p2.type).toBe("input");
		p2.respond({ success: true, value: "hello" });

		const results = await commandPromise;
		expect(results).toEqual([
			{ success: true, value: "a" },
			{ success: true, value: "hello" },
		]);
	});
});
