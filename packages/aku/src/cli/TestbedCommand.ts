import { BaseClass } from "../utils.ts";
import type { Command, CommandExecuteContext } from "./cli-types.ts";

export class TestbedCommand extends BaseClass implements Command {
	static override readonly name = "testbed";
	static readonly description = "Exercise CLI features for manual testing";

	async execute({ cli }: CommandExecuteContext): Promise<void> {
		const choice = await cli.select({
			prompt: "What would you like to test?",
			options: [
				{ label: "Content output", value: "content", note: "Test h1, h2, p, br, dl, ul, ol" },
				{ label: "Input prompt", value: "input", note: "Test text input with validation" },
				{ label: "Confirm prompt", value: "confirm", note: "Test yes/no confirmation" },
			],
		});

		if (!choice.success) {
			cli.p("Cancelled.");
			return;
		}

		switch (choice.value) {
			case "content":
				await this.#testContentOutput(cli);
				break;
			case "input":
				await this.#testInput(cli);
				break;
			case "confirm":
				await this.#testConfirm(cli);
				break;
		}
	}

	async #testContentOutput(cli: CommandExecuteContext["cli"]): Promise<void> {
		cli.h1("CLI Content Output Test");

		cli.h2("Paragraph");
		cli.p(
			"This is a paragraph. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
		);

		cli.h2("Definition List");
		cli.dl({
			items: [
				["short", "A brief description"],
				["medium-length", "A medium-length description that demonstrates alignment"],
				[
					"very-long-label-that-might-truncate",
					"This label might be truncated depending on terminal width. The description is also long to show wrapping behaviour.",
				],
			],
		});

		cli.br();
		cli.h2("Unordered List");
		cli.ul({
			items: ["Apples", "Bananas", "Cherries"],
		});

		cli.br();
		cli.h2("Ordered List");
		cli.ol({
			title: "Steps to make tea:",
			items: ["Boil the kettle", "Add tea bag to cup", "Pour hot water", "Add milk (optional)"],
		});

		cli.br();
		cli.h2("Ordered List with Custom Numbers");
		cli.ol({
			title: "There are two hard problems in distributed computing:",
			items: [
				{ listNumber: 2, label: "Exactly-once delivery" },
				{ listNumber: 1, label: "Deterministic ordering" },
				{ listNumber: 2, label: "Exactly-once delivery" },
			],
		});

		cli.br();
		cli.p("Content output test complete.");
	}

	async #testInput(cli: CommandExecuteContext["cli"]): Promise<void> {
		cli.h1("CLI Input Test");

		const nameResult = await cli.input({
			prompt: "Enter your name:",
			initialValue: "Anonymous",
		});

		if (!nameResult.success) {
			cli.p("Cancelled.");
			return;
		}

		cli.p(`Hello, ${nameResult.value}!`);

		const ageResult = await cli.input({
			prompt: "Enter your age:",
			required: true,
			parse: (value) => {
				const num = Number.parseInt(value, 10);
				if (Number.isNaN(num) || num < 0 || num > 150) {
					throw new Error("Please enter a valid age between 0 and 150");
				}
				return num;
			},
		});

		if (!ageResult.success) {
			cli.p("Cancelled.");
			return;
		}

		cli.p(`You are ${ageResult.value} years old.`);
		cli.br();
		cli.p("Input test complete.");
	}

	async #testConfirm(cli: CommandExecuteContext["cli"]): Promise<void> {
		cli.h1("CLI Confirm Test");

		const result = await cli.confirm({
			prompt: "Did everything work correctly?",
			defaultValue: true,
		});

		if (!result.success) {
			cli.p("Cancelled.");
			return;
		}

		if (result.value) {
			cli.p("Excellent! The confirm test completed successfully.");
		} else {
			cli.p("Something went wrong. Please report any issues.");
		}
	}
}
