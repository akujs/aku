import { CliExitError } from "./cli-errors.ts";

export function formatOutput(data: unknown, format: string, pretty: boolean): string {
	switch (format) {
		case "json":
			return pretty ? JSON.stringify(data, null, "    ") : JSON.stringify(data);
		default:
			throw new CliExitError(`Unknown format: "${format}". Supported formats: json`);
	}
}
