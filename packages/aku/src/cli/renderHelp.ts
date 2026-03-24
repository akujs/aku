import type { CommandDefinition } from "./cli-types.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import { buildUsageLine, formatArgumentDetail } from "./formatArgument.ts";

export function outputHumanCommandHelp(definition: CommandDefinition, cli: CliApi): void {
	cli.h1(`aku ${definition.name}`);
	cli.p(definition.description);

	const entries = Object.entries(definition.args ?? {});

	const positionals = entries.filter(([, def]) => def.positional);
	const named = entries.filter(([, def]) => !def.positional);

	cli.h2("Usage");
	cli.p(`  ${buildUsageLine(definition)}`);

	if (positionals.length > 0) {
		cli.h2("Arguments");
		cli.dl({
			items: positionals.map(([name, def]) => {
				const { label, description } = formatArgumentDetail(name, def);
				return { label, definition: description };
			}),
		});
	}

	if (named.length > 0) {
		cli.h2("Options");
		cli.dl({
			items: named.map(([name, def]) => {
				const { label, description } = formatArgumentDetail(name, def);
				return { label, definition: description };
			}),
		});
	}
}
