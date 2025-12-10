import type { SourceProject } from "./SourceProject.ts";

/**
 * Discovers entry points from a SourceProject.
 * Returns a map of entry point names to file paths.
 *
 * - `foo-entry-point.ts` → entry point named "foo"
 * - `a/b/b-entry-point.ts` → entry point at "a/b"
 */
export function discoverEntryPoints(project: SourceProject): Record<string, string> {
	const result: Record<string, string> = {};

	for (const file of project.root.allFiles()) {
		if (file.isEntryPoint()) {
			const name = file.entryPointName;
			if (name) {
				result[name] = file.path;
			}
		}
	}

	return result;
}
