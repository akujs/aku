import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { CliApiImpl } from "./CliApiImpl.ts";

describe.skip(CliApiImpl, () => {
	let output: string;
	let cli: CliApiImpl;

	beforeEach(() => {
		output = "";
		spyOn(process.stdout, "write").mockImplementation((str) => {
			output += str;
			return true;
		});
		cli = new CliApiImpl();
	});

	test("paragraph", () => {
		cli.p("Hello world");

		expect(output).toMatchSnapshot();
	});

	test("h1 renders bold", () => {
		cli.h1("My Title");

		expect(output).toMatchSnapshot();
	});

	test("h2 renders underlined", () => {
		cli.h2("My Subtitle");

		expect(output).toMatchSnapshot();
	});

	test("definitionList formats as aligned table", () => {
		cli.dl({
			items: [
				{ label: "short", definition: "First item" },
				{ label: "much-longer", definition: "Second item" },
				{ label: "mid", definition: "Third item" },
			],
		});

		expect(output).toMatchSnapshot();
	});

	test("definitionList with empty array outputs nothing", () => {
		cli.dl({ items: [] });

		expect(output).toBe("");
	});

	test("combined output", () => {
		cli.h1("Available commands");
		cli.dl({
			items: [
				{ label: "list", definition: "List all commands" },
				{ label: "db:migrate", definition: "Run database migrations" },
			],
		});

		expect(output).toMatchSnapshot();
	});
});
