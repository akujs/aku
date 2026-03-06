import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function writeCrashDumpAndExit(error: unknown): never {
	const dump = {
		timestamp: new Date().toISOString(),
		error:
			error instanceof Error
				? { name: error.name, message: error.message, stack: error.stack }
				: String(error),
		nodeVersion: process.version,
		platform: process.platform,
		cwd: process.cwd(),
	};

	const filename = `aku-crash-${Date.now()}.log`;
	const filepath = join(process.cwd(), filename);
	writeFileSync(filepath, JSON.stringify(dump, null, 2));

	process.stderr.write(`Unexpected error. Crash dump saved to: ${filepath}\n`);
	process.stderr.write("Please report this issue at: https://github.com/akujs/aku/issues\n");
	process.exit(1);
}
