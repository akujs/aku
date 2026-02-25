import { describe, expect, test } from "bun:test";
import { ServiceProvider } from "../core/ServiceProvider.ts";
import { createTestApplication } from "../test-utils/http.test-utils.ts";
import { createCliTestHarness, tokeniseCommand } from "./cli-test-harness.ts";
import type { CommandExecuteContext } from "./cli-types.ts";
import type { CliConfirmOptions, CliInputOptions, CliSelectOptions } from "./contracts/CliApi.ts";
import { defineCommand } from "./defineCommand.ts";

// ─── Test commands ───

const selectCommand = defineCommand({
	name: "select-demo",
	description: "A command with a select prompt",
	handler: async ({ cli }: CommandExecuteContext) => {
		const result = await cli.select({
			prompt: "Pick a colour",
			options: [
				{ label: "Red", value: "red" },
				{ label: "Blue", value: "blue" },
				{ label: "Green", value: "green" },
			],
		});
		if (result.success) {
			cli.p(`You chose: ${result.value}`);
		} else {
			cli.p("Cancelled");
		}
	},
});

const inputCommand = defineCommand({
	name: "input-demo",
	description: "A command with an input prompt",
	handler: async ({ cli }: CommandExecuteContext) => {
		const result = await cli.input({ prompt: "Enter your name", required: true });
		if (result.success) {
			cli.p(`Hello, ${result.value}!`);
		} else {
			cli.p("Cancelled");
		}
	},
});

const parseInputCommand = defineCommand({
	name: "parse-input-demo",
	description: "A command with a parsed input prompt",
	handler: async ({ cli }: CommandExecuteContext) => {
		const result = await cli.input({
			prompt: "Enter a number",
			parse: (value: string) => {
				const n = Number(value);
				if (Number.isNaN(n)) {
					throw new Error("Not a number");
				}
				return n;
			},
		});
		if (result.success) {
			cli.p(`Double: ${result.value * 2}`);
		} else {
			cli.p("Cancelled");
		}
	},
});

const confirmCommand = defineCommand({
	name: "confirm-demo",
	description: "A command with a confirm prompt",
	handler: async ({ cli }: CommandExecuteContext) => {
		const result = await cli.confirm({ prompt: "Are you sure?", defaultValue: false });
		if (result.success) {
			cli.p(`Answer: ${result.value}`);
		} else {
			cli.p("Cancelled");
		}
	},
});

const multiPromptCommand = defineCommand({
	name: "multi-prompt",
	description: "A command with multiple prompts",
	handler: async ({ cli }: CommandExecuteContext) => {
		const colour = await cli.select({
			prompt: "Pick a colour",
			options: [
				{ label: "Red", value: "red" },
				{ label: "Blue", value: "blue" },
			],
		});
		if (!colour.success) {
			cli.p("Cancelled at colour");
			return;
		}

		const name = await cli.input({ prompt: "Enter your name" });
		if (!name.success) {
			cli.p("Cancelled at name");
			return;
		}

		const confirm = await cli.confirm({ prompt: "Confirm?", defaultValue: true });
		if (!confirm.success) {
			cli.p("Cancelled at confirm");
			return;
		}

		cli.p(`${name.value} likes ${colour.value}: ${confirm.value}`);
	},
});

class TestProvider extends ServiceProvider {
	override get commands() {
		return [selectCommand, inputCommand, parseInputCommand, confirmCommand, multiPromptCommand];
	}
}

// ─── tokeniseCommand tests ───

describe(tokeniseCommand, () => {
	const vectors: [input: string, expected: string[]][] = [
		// basic splitting
		["foo", ["foo"]],
		["foo bar baz", ["foo", "bar", "baz"]],

		// whitespace handling
		["  foo   bar  ", ["foo", "bar"]],
		["", []],
		["   ", []],

		// single-quoted strings (content is literal, no escaping)
		["'hello world'", ["hello world"]],
		["foo 'bar baz' qux", ["foo", "bar baz", "qux"]],
		["'foo\\bar'", ["foo\\bar"]],

		// double-quoted strings
		['"hello world"', ["hello world"]],
		['foo "bar baz" qux', ["foo", "bar baz", "qux"]],

		// quotes within other quotes (quotes become literal)
		[`"it's here"`, ["it's here"]],
		[`'say "hello"'`, ['say "hello"']],
		[`'"foo"'`, ['"foo"']],
		[`"'foo'"`, ["'foo'"]],

		// adjacent quoted segments merge into one token
		[`"a""b"`, ["ab"]],
		[`'a''b'`, ["ab"]],
		[`"a"'b'`, ["ab"]],
		[`'a'"b"`, ["ab"]],
		["foo'bar baz'qux", ["foobar bazqux"]],
		['--flag="hello world"', ["--flag=hello world"]],

		// empty quoted strings preserved as empty tokens
		["foo '' bar", ["foo", "", "bar"]],
		['foo "" bar', ["foo", "", "bar"]],

		// backslash escaping outside quotes
		["foo\\ bar", ["foo bar"]],
		['foo\\"bar', ['foo"bar']],
	];

	test.each(vectors)("tokenises %j into %j", (input, expected) => {
		expect(tokeniseCommand(input)).toEqual(expected);
	});

	test("throws on unclosed single quote", () => {
		expect(() => tokeniseCommand("foo 'bar")).toThrow("Unclosed single quote");
	});

	test("throws on unclosed double quote", () => {
		expect(() => tokeniseCommand('foo "bar')).toThrow("Unclosed double quote");
	});
});

// ─── CliTestHarness tests ───

describe("answerSelect", () => {
	test("resolves with value", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["select-demo"]);
		await cli.answerSelect("red");
		await done;

		expect(cli.output).toContainEqual({ paragraph: "You chose: red" });
	});

	test("callback form", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["select-demo"]);
		await cli.answerSelect((opts: CliSelectOptions<unknown>) => opts.options[1].value);
		await done;

		expect(cli.output).toContainEqual({ paragraph: "You chose: blue" });
	});

	test("throws on invalid value", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		void cli.handleCommand(["select-demo"]);

		expect(cli.answerSelect("purple")).rejects.toThrow('Value "purple" is not a valid option');
	});

	test("throws on wrong type", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		void cli.handleCommand(["input-demo"]);

		expect(cli.answerSelect("red")).rejects.toThrow("Expected a select prompt but got input");
	});

	test("cancel form", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["select-demo"]);
		await cli.answerSelect({ cancel: true });
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Cancelled" });
	});
});

describe("answerInput", () => {
	test("resolves with string", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["input-demo"]);
		await cli.answerInput("Alice");
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Hello, Alice!" });
	});

	test("callback form", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["input-demo"]);
		await cli.answerInput((opts: CliInputOptions<unknown>) =>
			opts.prompt === "Enter your name" ? "Bob" : "Unknown",
		);
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Hello, Bob!" });
	});

	test("throws if required and empty", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		void cli.handleCommand(["input-demo"]);

		expect(cli.answerInput("")).rejects.toThrow("Input is required but received an empty string");
	});

	test("runs parse", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["parse-input-demo"]);
		await cli.answerInput("21");
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Double: 42" });
	});

	test("throws if parse throws", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		void cli.handleCommand(["parse-input-demo"]);

		expect(cli.answerInput("abc")).rejects.toThrow("Not a number");
	});

	test("throws on wrong type", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		void cli.handleCommand(["select-demo"]);

		expect(cli.answerInput("hello")).rejects.toThrow("Expected a input prompt but got select");
	});

	test("cancel form", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["input-demo"]);
		await cli.answerInput({ cancel: true });
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Cancelled" });
	});
});

describe("answerConfirm", () => {
	test("resolves with boolean", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["confirm-demo"]);
		await cli.answerConfirm(true);
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Answer: true" });
	});

	test("callback form", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["confirm-demo"]);
		await cli.answerConfirm((opts: CliConfirmOptions) => opts.defaultValue);
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Answer: false" });
	});

	test("throws on wrong type", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		void cli.handleCommand(["select-demo"]);

		expect(cli.answerConfirm(true)).rejects.toThrow("Expected a confirm prompt but got select");
	});

	test("cancel form", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["confirm-demo"]);
		await cli.answerConfirm({ cancel: true });
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Cancelled" });
	});
});

describe("full sequential flow", () => {
	test("drives multiple prompts", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["multi-prompt"]);
		await cli.answerSelect("red");
		await cli.answerInput("Alice");
		await cli.answerConfirm(true);
		await done;

		expect(cli.output).toContainEqual({ paragraph: "Alice likes red: true" });
	});

	test("output captured correctly", async () => {
		const { app } = createTestApplication({ providers: [TestProvider] });
		const cli = createCliTestHarness(app);

		const done = cli.handleCommand(["select-demo"]);
		await cli.answerSelect("green");
		await done;

		expect(cli.output).toMatchInlineSnapshot(`
		  [
		    {
		      "paragraph": "You chose: green",
		    },
		  ]
		`);
	});
});
