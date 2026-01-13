import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SourceProject } from "./SourceProject.ts";

/**
 * The suffix that identifies entry point files.
 */
export const ENTRY_POINT_SUFFIX = "-entry-point.ts";

/**
 * Check if a filename is an entry point file.
 */
export function isEntryPointFile(basename: string): boolean {
	return basename.endsWith(ENTRY_POINT_SUFFIX);
}

/**
 * Check if a directory should be skipped during source traversal.
 */
export function shouldSkipDirectory(dirname: string): boolean {
	return dirname === "test-utils";
}

/**
 * Derive the entry point name from a relative file path.
 *
 * - `foo-entry-point.ts` → "foo"
 * - `a/b/b-entry-point.ts` → "a/b"
 */
export function getEntryPointName(relativePath: string): string | null {
	const parts = relativePath.split("/");
	const basename = parts[parts.length - 1];
	if (!isEntryPointFile(basename)) return null;

	const nameFromFile = basename.replace(ENTRY_POINT_SUFFIX, "");
	return parts.length === 1 ? nameFromFile : parts.slice(0, -1).join("/");
}

/**
 * Discovers entry points by scanning the filesystem.
 * This is a lightweight alternative to loading a full SourceProject,
 * suitable for use in build tools that run under Node.js.
 *
 * Returns a map of entry point names to absolute file paths.
 */
export function discoverEntryPointsFromFilesystem(srcPath: string): Record<string, string> {
	const result: Record<string, string> = {};

	function walk(dir: string, relativeBase: string): void {
		const entries = readdirSync(dir).sort();
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stat = statSync(fullPath);

			if (stat.isDirectory()) {
				if (!shouldSkipDirectory(entry)) {
					const newRelativeBase = relativeBase ? `${relativeBase}/${entry}` : entry;
					walk(fullPath, newRelativeBase);
				}
			} else if (isEntryPointFile(entry)) {
				const relativePath = relativeBase ? `${relativeBase}/${entry}` : entry;
				const name = getEntryPointName(relativePath);
				if (name) {
					result[name] = fullPath;
				}
			}
		}
	}

	walk(srcPath, "");
	return result;
}

/**
 * Discovers entry points from a SourceProject.
 * Returns a map of entry point names to relative file paths.
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
