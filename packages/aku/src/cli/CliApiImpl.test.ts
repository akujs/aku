import { describe, expect, test } from "bun:test";
import { CliApiImpl } from "./CliApiImpl.ts";
import { MemoryProcessApi } from "./MemoryProcessApi.ts";

describe(CliApiImpl, () => {
	function setup(options?: { stdoutColumns?: number; env?: Record<string, string> }) {
		const proc = new MemoryProcessApi({
			stdoutColumns: options?.stdoutColumns ?? 60,
			env: options?.env,
		});
		const cli = new CliApiImpl(proc);
		return { proc, cli };
	}

	describe("columns", () => {
		test("uses stdoutColumns when COLUMNS env var is not set", () => {
			const { cli } = setup({ stdoutColumns: 100 });

			expect(cli.columns).toBe(100);
		});

		test("caps stdoutColumns at 120", () => {
			const { cli } = setup({ stdoutColumns: 200 });

			expect(cli.columns).toBe(120);
		});

		test("passes through stdoutColumns value directly", () => {
			const { cli } = setup({ stdoutColumns: 42 });

			expect(cli.columns).toBe(42);
		});

		test("COLUMNS env var overrides stdoutColumns", () => {
			const { cli } = setup({ stdoutColumns: 100, env: { COLUMNS: "40" } });

			expect(cli.columns).toBe(40);
		});

		test("COLUMNS env var is not capped at 120", () => {
			const { cli } = setup({ env: { COLUMNS: "200" } });

			expect(cli.columns).toBe(200);
		});

		test("ignores invalid COLUMNS env var", () => {
			const { cli } = setup({ stdoutColumns: 90, env: { COLUMNS: "not-a-number" } });

			expect(cli.columns).toBe(90);
		});
	});

	test("p() outputs wrapped text with trailing blank line", () => {
		const { proc, cli } = setup();

		cli.p("Hello world");

		expect(proc.state).toEqual({ stdout: ["Hello world\n\n"] });
	});

	test("br() outputs empty line", () => {
		const { proc, cli } = setup();

		cli.br();

		expect(proc.state).toEqual({ stdout: ["\n"] });
	});

	test("h1() renders bold with line breaks above and below", () => {
		const { proc, cli } = setup();

		cli.h1("My Title");

		expect(proc.state).toEqual({ stdout: ["\n\x1B[1mMY TITLE\x1B[22m\n\n"] });
	});

	test("h2() renders underlined with line break below", () => {
		const { proc, cli } = setup();

		cli.h2("My Subtitle");

		expect(proc.state).toEqual({ stdout: ["\x1B[4mMy Subtitle\x1B[24m\n"] });
	});

	test("dl() formats as aligned table with blue labels", () => {
		const { proc, cli } = setup();

		cli.dl({
			items: [
				{ label: "short", definition: "First item" },
				{ label: "much-longer", definition: "Second item" },
				{ label: "mid", definition: "Third item" },
			],
		});

		expect(proc.state.stdout?.join("")).toMatchInlineSnapshot(`
"  \x1B[34mshort      \x1B[39m  First item
  \x1B[34mmuch-longer\x1B[39m  Second item
  \x1B[34mmid        \x1B[39m  Third item

"
`);
	});

	test("dl() with title outputs title first", () => {
		const { proc, cli } = setup();

		cli.dl({
			title: "Options:",
			items: [["--help", "Show help"]],
		});

		expect(proc.state.stdout?.join("")).toMatchInlineSnapshot(`
"Options:

  \x1B[34m--help\x1B[39m  Show help

"
`);
	});

	test("dl() with empty array outputs nothing", () => {
		const { proc, cli } = setup();

		cli.dl({ items: [] });

		expect(proc.state).toEqual({});
	});

	test("ul() formats as bullet list with blue bullets", () => {
		const { proc, cli } = setup();

		cli.ul({
			items: ["Apples", "Bananas", "Cherries"],
		});

		expect(proc.state.stdout?.join("")).toMatchInlineSnapshot(`
"  \x1B[34m-\x1B[39m  Apples
  \x1B[34m-\x1B[39m  Bananas
  \x1B[34m-\x1B[39m  Cherries

"
`);
	});

	test("ul() with title outputs title first", () => {
		const { proc, cli } = setup();

		cli.ul({
			title: "Fruits:",
			items: ["Apples", "Pears"],
		});

		expect(proc.state.stdout?.join("")).toMatchInlineSnapshot(`
"Fruits:

  \x1B[34m-\x1B[39m  Apples
  \x1B[34m-\x1B[39m  Pears

"
`);
	});

	test("ol() formats as numbered list with blue numbers", () => {
		const { proc, cli } = setup();

		cli.ol({
			items: ["First", "Second", "Third"],
		});

		expect(proc.state.stdout?.join("")).toMatchInlineSnapshot(`
"  \x1B[34m1.\x1B[39m  First
  \x1B[34m2.\x1B[39m  Second
  \x1B[34m3.\x1B[39m  Third

"
`);
	});

	test("ol() supports custom list numbers", () => {
		const { proc, cli } = setup();

		cli.ol({
			items: [
				{ listNumber: 2, label: "Exactly-once delivery" },
				{ listNumber: 1, label: "Deterministic ordering" },
				{ listNumber: 2, label: "Exactly-once delivery" },
			],
		});

		expect(proc.state.stdout?.join("")).toMatchInlineSnapshot(`
"  \x1B[34m2.\x1B[39m  Exactly-once delivery
  \x1B[34m1.\x1B[39m  Deterministic ordering
  \x1B[34m2.\x1B[39m  Exactly-once delivery

"
`);
	});

	test("ol() with title outputs title first", () => {
		const { proc, cli } = setup();

		cli.ol({
			title: "Steps:",
			items: ["Do this", "Then that"],
		});

		expect(proc.state.stdout?.join("")).toMatchInlineSnapshot(`
"Steps:

  \x1B[34m1.\x1B[39m  Do this
  \x1B[34m2.\x1B[39m  Then that

"
`);
	});

	test("combined output", () => {
		const { proc, cli } = setup();

		cli.h1("Available commands");
		cli.dl({
			items: [
				{ label: "list", definition: "List all commands" },
				{ label: "db:migrate", definition: "Run database migrations" },
			],
		});

		expect(proc.state.stdout?.join("")).toMatchInlineSnapshot(`
"
\x1B[1mAVAILABLE COMMANDS\x1B[22m

  \x1B[34mlist      \x1B[39m  List all commands
  \x1B[34mdb:migrate\x1B[39m  Run database migrations

"
`);
	});
});
