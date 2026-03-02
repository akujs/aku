import { createApplication, ServiceProvider } from "@akujs/aku";
import type { CommandDefinition, CommandGroupDefinition } from "@akujs/aku/cli";
import { argsDemoCommand } from "../commands/args-demo.ts";
import { greetCommand } from "../commands/greet.ts";
import { inputDemoCommand } from "../commands/input-demo.ts";
import { outputDemoCommand } from "../commands/output-demo.ts";

class CliDemoProvider extends ServiceProvider {
	override get commandGroups(): CommandGroupDefinition[] {
		return [{ name: "demo", description: "CLI demonstration commands" }];
	}

	override get commands(): CommandDefinition[] {
		return [outputDemoCommand, inputDemoCommand, argsDemoCommand, greetCommand];
	}
}

export const app = createApplication({
	providers: [CliDemoProvider],
});
