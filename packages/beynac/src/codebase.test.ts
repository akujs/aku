import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { discoverEntryPoints } from "./test-utils/source/discoverEntryPoints.ts";
import {
	getGeneratedFileContent,
	getPackageExports,
} from "./test-utils/source/generated-content.ts";
import { getFileErrors } from "./test-utils/source/getFileErrors.ts";
import { SourceProject } from "./test-utils/source/SourceProject.ts";
import { mapObjectValues } from "./utils.ts";

const srcDir = join(import.meta.dir);
const project = await SourceProject.getBeynac();
const entryPoints = discoverEntryPoints(project);
const filePaths = project.root.allFiles().map((f) => f.path);
const generatedFiles = Object.keys(getGeneratedFileContent(project));

describe("codebase invariants", () => {
	test.each(filePaths)("%s", (path) => {
		const file = project.getFile(path);
		const errors = getFileErrors(file);
		expect(errors).toEqual([]);
	});

	test.each(generatedFiles)("src/%s matches generated content", async (filename) => {
		const expectedContent = getGeneratedFileContent(project)[filename];
		const filePath = join(srcDir, filename);
		const actualContent = await readFile(filePath, "utf-8");

		if (expectedContent !== actualContent) {
			console.error(`💥 ${filename} content needs updating, run 'bun codegen'`);
		}
		expect(actualContent).toEqual(expectedContent);
	});

	test("package.json exports match generated content", async () => {
		const packageJsonPath = join(srcDir, "..", "package.json");
		const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
		expect(packageJson.exports).toEqual(getPackageExports(entryPoints));
	});

	test("package.json peerDependencies are all optional", async () => {
		const packageJsonPath = join(srcDir, "..", "package.json");
		const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
		expect(packageJson.peerDependenciesMeta).toEqual(
			mapObjectValues(packageJson.peerDependencies, () => ({ optional: true })),
		);
	});
});
