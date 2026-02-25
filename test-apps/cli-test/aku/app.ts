import { createApplication, ServiceProvider } from "@akujs/aku";
import type { CommandDefinition } from "@akujs/aku/cli";
import { greetCommand } from "../commands/greet.ts";
import { inputDemoCommand } from "../commands/input-demo.ts";
import { outputDemoCommand } from "../commands/output-demo.ts";

class CliDemoProvider extends ServiceProvider {
	override get commands(): CommandDefinition[] {
		return [outputDemoCommand, inputDemoCommand, greetCommand];
	}
}

export const app = createApplication({
	providers: [CliDemoProvider],
});
