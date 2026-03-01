import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { CliApiImpl } from "./CliApiImpl.ts";

describe(CliApiImpl, () => {
	let stdout: string;
	let cli: CliApiImpl;

	beforeEach(() => {
		stdout = "";
		delete process.env.COLUMNS;
		spyOn(process.stdout, "write").mockImplementation((str) => {
			stdout += str;
			return true;
		});
		// Mock terminal width for consistent tests
		Object.defineProperty(process.stdout, "columns", { value: 60, configurable: true });
		cli = new CliApiImpl();
	});

	describe("columns", () => {
		test("uses process.stdout.columns when COLUMNS env var is not set", () => {
			delete process.env.COLUMNS;
			Object.defineProperty(process.stdout, "columns", { value: 100, configurable: true });

			expect(cli.columns).toBe(100);
		});

		test("caps process.stdout.columns at 120", () => {
			delete process.env.COLUMNS;
			Object.defineProperty(process.stdout, "columns", { value: 200, configurable: true });

			expect(cli.columns).toBe(120);
		});

		test("falls back to 80 when stdout has no columns", () => {
			delete process.env.COLUMNS;
			Object.defineProperty(process.stdout, "columns", { value: 0, configurable: true });

			expect(cli.columns).toBe(80);
		});

		test("COLUMNS env var overrides process.stdout.columns", () => {
			process.env.COLUMNS = "40";
			Object.defineProperty(process.stdout, "columns", { value: 100, configurable: true });

			expect(cli.columns).toBe(40);
		});

		test("COLUMNS env var is not capped at 120", () => {
			process.env.COLUMNS = "200";

			expect(cli.columns).toBe(200);
		});

		test("ignores invalid COLUMNS env var", () => {
			process.env.COLUMNS = "not-a-number";
			Object.defineProperty(process.stdout, "columns", { value: 90, configurable: true });

			expect(cli.columns).toBe(90);
		});
	});

	test("p() outputs wrapped text with trailing blank line", () => {
		cli.p("Hello world");

		expect(stdout).toMatchInlineSnapshot(`
"Hello world

"
`);
	});

	test("br() outputs empty line", () => {
		cli.br();

		expect(stdout).toMatchInlineSnapshot(`
"
"
`);
	});

	test("h1() renders bold with line breaks above and below", () => {
		cli.h1("My Title");

		expect(stdout).toMatchInlineSnapshot(`
"
\x1B[1mMY TITLE\x1B[22m

"
`);
	});

	test("h2() renders underlined with line break below", () => {
		cli.h2("My Subtitle");

		expect(stdout).toMatchInlineSnapshot(`
"\x1B[4mMy Subtitle\x1B[24m
"
`);
	});

	test("dl() formats as aligned table with blue labels", () => {
		cli.dl({
			items: [
				{ label: "short", definition: "First item" },
				{ label: "much-longer", definition: "Second item" },
				{ label: "mid", definition: "Third item" },
			],
		});

		expect(stdout).toMatchInlineSnapshot(`
"  \x1B[34mshort      \x1B[39m  First item
  \x1B[34mmuch-longer\x1B[39m  Second item
  \x1B[34mmid        \x1B[39m  Third item
"
`);
	});

	test("dl() with title outputs title first", () => {
		cli.dl({
			title: "Options:",
			items: [["--help", "Show help"]],
		});

		expect(stdout).toMatchInlineSnapshot(`
"Options:

  \x1B[34m--help\x1B[39m  Show help
"
`);
	});

	test("dl() with empty array outputs nothing", () => {
		cli.dl({ items: [] });

		expect(stdout).toBe("");
	});

	test("ul() formats as bullet list with blue bullets", () => {
		cli.ul({
			items: ["Apples", "Bananas", "Cherries"],
		});

		expect(stdout).toMatchInlineSnapshot(`
"  \x1B[34m-\x1B[39m  Apples
  \x1B[34m-\x1B[39m  Bananas
  \x1B[34m-\x1B[39m  Cherries
"
`);
	});

	test("ul() with title outputs title first", () => {
		cli.ul({
			title: "Fruits:",
			items: ["Apples", "Pears"],
		});

		expect(stdout).toMatchInlineSnapshot(`
"Fruits:

  \x1B[34m-\x1B[39m  Apples
  \x1B[34m-\x1B[39m  Pears
"
`);
	});

	test("ol() formats as numbered list with blue numbers", () => {
		cli.ol({
			items: ["First", "Second", "Third"],
		});

		expect(stdout).toMatchInlineSnapshot(`
"  \x1B[34m1.\x1B[39m  First
  \x1B[34m2.\x1B[39m  Second
  \x1B[34m3.\x1B[39m  Third
"
`);
	});

	test("ol() supports custom list numbers", () => {
		cli.ol({
			items: [
				{ listNumber: 2, label: "Exactly-once delivery" },
				{ listNumber: 1, label: "Deterministic ordering" },
				{ listNumber: 2, label: "Exactly-once delivery" },
			],
		});

		expect(stdout).toMatchInlineSnapshot(`
"  \x1B[34m2.\x1B[39m  Exactly-once delivery
  \x1B[34m1.\x1B[39m  Deterministic ordering
  \x1B[34m2.\x1B[39m  Exactly-once delivery
"
`);
	});

	test("ol() with title outputs title first", () => {
		cli.ol({
			title: "Steps:",
			items: ["Do this", "Then that"],
		});

		expect(stdout).toMatchInlineSnapshot(`
"Steps:

  \x1B[34m1.\x1B[39m  Do this
  \x1B[34m2.\x1B[39m  Then that
"
`);
	});

	test("combined output", () => {
		cli.h1("Available commands");
		cli.dl({
			items: [
				{ label: "list", definition: "List all commands" },
				{ label: "db:migrate", definition: "Run database migrations" },
			],
		});

		expect(stdout).toMatchInlineSnapshot(`
"
\x1B[1mAVAILABLE COMMANDS\x1B[22m

  \x1B[34mlist      \x1B[39m  List all commands
  \x1B[34mdb:migrate\x1B[39m  Run database migrations
"
`);
	});
});
