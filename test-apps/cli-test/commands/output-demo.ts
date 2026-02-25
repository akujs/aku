import { defineCommand } from "@akujs/aku/cli";

export const outputDemoCommand = defineCommand({
	name: "output-demo",
	description: "Exercise all CLI output methods",
	handler: async ({ cli }) => {
		cli.h1("CLI Output Demo");

		cli.h2("Paragraphs");
		cli.p("This is a short paragraph.");
		cli.p(
			"This is a longer paragraph that should demonstrate text wrapping behaviour. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
		);

		cli.br();

		cli.h2("Definition List (tuple form)");
		cli.dl({
			items: [
				["short", "A brief description"],
				["medium-length", "A medium-length description that demonstrates alignment"],
				[
					"very-long-label-name",
					"This label is longer to show how alignment adapts. The description is also long to show wrapping behaviour.",
				],
			],
		});

		cli.br();

		cli.h2("Definition List (object form, with title)");
		cli.dl({
			title: "Available colours:",
			items: [
				{ label: "red", definition: "A warm colour associated with fire" },
				{ label: "blue", definition: "A cool colour associated with the sky" },
				{ label: "green", definition: "The colour of nature and growth" },
			],
		});

		cli.br();

		cli.h2("Unordered List (plain strings)");
		cli.ul({
			items: ["Apples", "Bananas", "Cherries"],
		});

		cli.br();

		cli.h2("Unordered List (object form, with title)");
		cli.ul({
			title: "Fruits in season:",
			items: [{ label: "Strawberries" }, { label: "Raspberries" }, { label: "Blueberries" }],
		});

		cli.br();

		cli.h2("Ordered List (plain strings, with title)");
		cli.ol({
			title: "Steps to make tea:",
			items: ["Boil the kettle", "Add tea bag to cup", "Pour hot water", "Add milk (optional)"],
		});

		cli.br();

		cli.h2("Ordered List (custom numbering)");
		cli.ol({
			title: "There are two hard problems in distributed computing:",
			items: [
				{ listNumber: 2, label: "Exactly-once delivery" },
				{ listNumber: 1, label: "Deterministic ordering" },
				{ listNumber: 2, label: "Exactly-once delivery" },
			],
		});

		cli.br();
		cli.p("Output demo complete.");
	},
});
