import type { CommandDefinition } from "./cli-types.ts";
import type { CliApi } from "./contracts/CliApi.ts";
import { formatArgumentDetail, formatUsageToken } from "./formatArgument.ts";

export function renderHelp(definition: CommandDefinition, cli: CliApi): void {
	cli.h1(definition.name);
	cli.p(definition.description);

	const schema = definition.args ?? {};
	const entries = Object.entries(schema);

	const positionals = entries.filter(([, def]) => def.positional);
	const named = entries.filter(([, def]) => !def.positional);

	// Build usage line
	const usageTokens: string[] = [definition.name];

	for (const [name, def] of positionals) {
		const token = formatUsageToken(name, def);
		if (token) usageTokens.push(token);
	}

	for (const [name, def] of named) {
		const token = formatUsageToken(name, def);
		if (token) usageTokens.push(token);
	}

	const hasOptionalNamed = named.some(([name, def]) => formatUsageToken(name, def) === null);
	if (hasOptionalNamed) {
		usageTokens.push("[options]");
	}

	cli.h2("Usage");
	cli.p(`  ${usageTokens.join(" ")}`);

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
