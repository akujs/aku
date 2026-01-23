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

	test("title renders bold", () => {
		terminal.title("My Title");

		expect(output).toMatchSnapshot();
	});

	test("subtitle renders underlined", () => {
		terminal.subtitle("My Subtitle");

		expect(output).toMatchSnapshot();
	});

	test("definitionList formats as aligned table", () => {
		terminal.dl([
			{ label: "short", definition: "First item" },
			{ label: "much-longer", definition: "Second item" },
			{ label: "mid", definition: "Third item" },
		]);

		expect(output).toMatchSnapshot();
	});

	test("definitionList with empty array outputs nothing", () => {
		terminal.dl([]);

		expect(output).toBe("");
	});

	test("combined output", () => {
		terminal.title("Available commands");
		terminal.dl([
			{ label: "list", definition: "List all commands" },
			{ label: "db:migrate", definition: "Run database migrations" },
		]);

		expect(output).toMatchSnapshot();
	});
});
