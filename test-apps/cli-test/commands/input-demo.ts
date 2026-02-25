import { defineCommand } from "@akujs/aku/cli";

export const inputDemoCommand = defineCommand({
	name: "input-demo",
	description: "Exercise all CLI input methods",
	handler: async ({ cli }) => {
		cli.h1("CLI Input Demo");

		// Select prompt
		cli.h2("Select");
		const colour = await cli.select({
			prompt: "What is your favourite colour?",
			options: [
				{ label: "Red", value: "red", note: "A warm colour" },
				{ label: "Blue", value: "blue", note: "A cool colour" },
				{ label: "Green", value: "green", note: "The colour of nature" },
				{ label: "Yellow", value: "yellow" },
			],
		});
		if (!colour.success) {
			cli.p("Cancelled.");
			return;
		}
		cli.p(`You chose: ${colour.value}`);

		cli.br();

		// Basic text input
		cli.h2("Text Input (basic)");
		const name = await cli.input({
			prompt: "Enter your name:",
		});
		if (!name.success) {
			cli.p("Cancelled.");
			return;
		}
		cli.p(`Hello, ${name.value}!`);

		cli.br();

		// Text input with initial value
		cli.h2("Text Input (with initial value)");
		const city = await cli.input({
			prompt: "Enter your city:",
			initialValue: "London",
		});
		if (!city.success) {
			cli.p("Cancelled.");
			return;
		}
		cli.p(`You live in ${city.value}.`);

		cli.br();

		// Required text input with validation
		cli.h2("Text Input (required, with validation)");
		const age = await cli.input({
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
		if (!age.success) {
			cli.p("Cancelled.");
			return;
		}
		cli.p(`You are ${age.value} years old.`);

		cli.br();

		// Confirm prompt
		cli.h2("Confirm");
		const confirmed = await cli.confirm({
			prompt: "Did everything work correctly?",
			defaultValue: true,
		});
		if (!confirmed.success) {
			cli.p("Cancelled.");
			return;
		}

		if (confirmed.value) {
			cli.p("Excellent! All input methods working.");
		} else {
			cli.p("Something went wrong. Please report any issues.");
		}
	},
});
