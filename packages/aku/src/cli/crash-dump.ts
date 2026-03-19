import { join } from "node:path";
import { type ProcessApi, realProcessApi } from "./process-api.ts";

export function writeCrashDumpAndExit(error: unknown, proc: ProcessApi = realProcessApi): void {
	const dump = {
		timestamp: new Date().toISOString(),
		error: serialiseError(error),
		nodeVersion: proc.version(),
		platform: proc.platform(),
		cwd: proc.cwd(),
	};

	const filename = `aku-crash-${Date.now()}.log`;
	const filepath = join(proc.cwd(), filename);
	const content = JSON.stringify(dump, null, 2);

	if (proc.writeFile(filepath, content)) {
		proc.stderr(`Unexpected error. Crash dump saved to: ${filepath}\n`);
	} else {
		proc.stderr(`Unexpected error. Failed to write crash dump file.\n`);
		proc.stderr(`Crash dump:\n${content}\n`);
	}
	proc.stderr("Please report this issue at: https://github.com/akujs/aku/issues\n");
	proc.exit(1);
}

function serialiseError(error: unknown): unknown {
	if (!(error instanceof Error)) {
		return String(error);
	}
	const result: Record<string, unknown> = {
		name: error.name,
		message: error.message,
		stack: error.stack,
	};
	if (error.cause !== undefined) {
		result.cause = serialiseError(error.cause);
	}
	return result;
}
