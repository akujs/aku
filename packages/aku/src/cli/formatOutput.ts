import { formatToon } from "../helpers/format/toon.ts";
import { CliExitError } from "./cli-errors.ts";

export function formatOutput(data: unknown, format: string, pretty: boolean): string {
	switch (format) {
		case "json":
			return pretty ? JSON.stringify(data, null, "    ") : JSON.stringify(data);
		case "toon":
			return formatToon(data);
		default:
			throw new CliExitError(`Unknown format: "${format}". Supported formats: json, toon`);
	}
}
