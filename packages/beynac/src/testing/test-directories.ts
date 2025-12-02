import * as fs from "node:fs";
import * as os from "node:os";
// oxlint-disable-next-line no-restricted-imports
import * as path from "node:path";
import { randomId } from "../helpers/str/random.ts";

const BEYNAC_TEST_ROOT = path.join(os.tmpdir(), "beynac-test");
const PID_FOLDER = path.join(BEYNAC_TEST_ROOT, String(process.pid));

let hasCleanedOrphans = false;

/**
 * Create a temporary directory and return its absolute path.
 *
 * To prevent build-up of stale test data, the first time you call this
 * function, it will scan for and delete any test directories created by
 * old test processes that have exited, and delete them.
 *
 * @param options.prefix - Optional prefix for the directory name
 * @param options.cleanOldFolders - Whether to clean up orphaned directories on first call (default: true)
 */
export function createTestDirectory(
	options: { prefix?: string; cleanOldFolders?: boolean } = {},
): string {
	const { prefix = "", cleanOldFolders = true } = options;
	if (cleanOldFolders && !hasCleanedOrphans) {
		cleanupOrphanedFolders();
		hasCleanedOrphans = true;
	}

	const testDir = path.join(PID_FOLDER, `${prefix}${randomId(10)}`);
	fs.mkdirSync(testDir, { recursive: true });

	return testDir;
}

function isProcessAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) {
		return false;
	}

	try {
		process.kill(pid, 0);
		return true;
	} catch (e: unknown) {
		const error = e as { code?: string };
		if (error.code === "EPERM") {
			// Process exists but we don't have permission to signal it
			return true;
		}
		if (error.code === "ESRCH") {
			// Process doesn't exist
			return false;
		}
		// We shouldn't be getting other errors, if we do, rethrow
		// https://www.man7.org/linux/man-pages/man2/kill.2.html
		throw e;
	}
}

function cleanupOrphanedFolders(): void {
	const entries = withDeleteErrors(BEYNAC_TEST_ROOT, () => {
		return fs.readdirSync(BEYNAC_TEST_ROOT);
	});
	if (!entries) {
		return;
	}
	for (const entry of entries) {
		const pid = parseInt(entry, 10);
		if (!Number.isNaN(pid) && !isProcessAlive(pid)) {
			const entryPath = path.join(BEYNAC_TEST_ROOT, entry);
			withDeleteErrors(entryPath, () => {
				fs.rmSync(entryPath, { recursive: true, force: true });
			});
		}
	}
}

function withDeleteErrors<T>(path: string, fn: () => T): T | null {
	try {
		return fn();
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			typeof error.code === "string"
		) {
			if (error.code !== "ENOENT") {
				// TODO: Connect to logging mechanism when available
				// eslint-disable-next-line no-console
				console.error(`Error deleting test directory at ${path}`, error);
			}
			return null;
		}
		throw error;
	}
}
