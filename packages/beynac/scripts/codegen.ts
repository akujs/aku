#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	getGeneratedFileContent,
	getPackageExports,
} from "../src/test-utils/source/generated-content";
import { SourceProject } from "../src/test-utils/source/SourceProject";

async function main() {
	const srcDir = join(import.meta.dir, "..", "src");
	const project = await SourceProject.load(srcDir);
	const generatedFiles = getGeneratedFileContent(project);

	for (const [filename, content] of Object.entries(generatedFiles)) {
		const filePath = join(srcDir, filename);
		await writeFile(filePath, content, "utf-8");

		console.log(`✓ Generated ${filePath}`);
	}

	// Update package.json exports
	const packageJsonPath = join(import.meta.dir, "..", "package.json");
	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
	packageJson.exports = getPackageExports();
	await writeFile(packageJsonPath, JSON.stringify(packageJson, null, "  ") + "\n", "utf-8");
	console.log(`✓ Generated package.json exports`);
}

main().catch((error) => {
	console.error("Error generating exports:", error);
	process.exit(1);
});
