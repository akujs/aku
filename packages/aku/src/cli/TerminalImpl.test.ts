import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { TerminalImpl } from "./TerminalImpl.ts";

describe.skip(TerminalImpl, () => {
	let output: string;
	let terminal: TerminalImpl;

	beforeEach(() => {
		output = "";
		spyOn(process.stdout, "write").mockImplementation((str) => {
			output += str;
			return true;
		});
		terminal = new TerminalImpl();
	});

	test("paragraph", () => {
		terminal.p("Hello world");

		expect(output).toMatchSnapshot();
	});

	test("h1 renders bold", () => {
		terminal.h1("My Title");

		expect(output).toMatchSnapshot();
	});

	test("h2 renders underlined", () => {
		terminal.h2("My Subtitle");

		expect(output).toMatchSnapshot();
	});

	test("definitionList formats as aligned table", () => {
		terminal.dl({
			items: [
				{ label: "short", definition: "First item" },
				{ label: "much-longer", definition: "Second item" },
				{ label: "mid", definition: "Third item" },
			],
		});

		expect(output).toMatchSnapshot();
	});

	test("definitionList with empty array outputs nothing", () => {
		terminal.dl({ items: [] });

		expect(output).toBe("");
	});

	test("combined output", () => {
		terminal.h1("Available commands");
		terminal.dl({
			items: [
				{ label: "list", definition: "List all commands" },
				{ label: "db:migrate", definition: "Run database migrations" },
			],
		});

		expect(output).toMatchSnapshot();
	});
});
