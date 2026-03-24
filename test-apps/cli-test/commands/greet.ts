import { defineCommand } from "@akujs/aku/cli";

const greetArgs = {
	name: { type: "string", positional: true, description: "Name to greet" },
	greeting: { type: "string", description: "Greeting text", default: "Hello" },
	shout: { type: "boolean", description: "Shout the greeting", default: false },
	times: { type: "number", description: "Repeat count", default: 1 },
} as const;

export const greetCommand = defineCommand({
	name: "greet",
	description: "Greet someone with typed arguments",
	args: greetArgs,
	handler: async ({ args, cli }) => {
		const name = args.name ?? "World";
		let message = `${args.greeting}, ${name}!`;
		if (args.shout) {
			message = message.toUpperCase();
		}
		for (let i = 0; i < args.times; i++) {
			cli.p(message);
		}
	},
});
