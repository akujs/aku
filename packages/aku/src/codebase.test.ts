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
const project = await SourceProject.getAku();
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

	test("bun version meets minimum requirement", async () => {
		const repoRoot = join(srcDir, "..", "..", "..");
		const bunVersionPath = join(repoRoot, ".bun-version");
		const packageJsonPath = join(repoRoot, "package.json");

		const requiredVersion = (await readFile(bunVersionPath, "utf-8")).trim();
		const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
		const enginesVersion = packageJson.engines?.bun?.replace(/^>=/, "");

		expect(requiredVersion).toBe(enginesVersion);

		const actualVersion = Bun.version;

		const parseVersion = (v: string): [number, number, number] => {
			const parts = v.split(".").map(Number);
			return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
		};

		const [reqMajor, reqMinor, reqPatch] = parseVersion(requiredVersion);
		const [actMajor, actMinor, actPatch] = parseVersion(actualVersion);

		const meetsRequirement =
			actMajor > reqMajor ||
			(actMajor === reqMajor && actMinor > reqMinor) ||
			(actMajor === reqMajor && actMinor === reqMinor && actPatch >= reqPatch);

		if (!meetsRequirement) {
			console.error(
				`Bun version ${actualVersion} is below minimum required ${requiredVersion}.\n` +
					`Recommend using bunVM (https://bunvm.com/) to manage Bun versions.`,
			);
		}
		expect(meetsRequirement).toBe(true);
	});

	test("node version meets minimum requirement", async () => {
		const repoRoot = join(srcDir, "..", "..", "..");
		const nvmrcPath = join(repoRoot, ".nvmrc");
		const packageJsonPath = join(repoRoot, "package.json");

		const nvmrcMajor = (await readFile(nvmrcPath, "utf-8")).trim();
		const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
		const enginesVersion = packageJson.engines?.node?.replace(/^>=/, "");
		const enginesMajor = enginesVersion?.split(".")[0];

		expect(nvmrcMajor).toBe(enginesMajor);

		const requiredMajor = Number(nvmrcMajor);
		const actualMajor = Number(process.version.slice(1).split(".")[0]);

		const meetsRequirement = actualMajor >= requiredMajor;

		if (!meetsRequirement) {
			console.error(
				`Node.js major version ${actualMajor} is below minimum required ${requiredMajor}.\n` +
					`Recommend using fnm (https://github.com/Schniz/fnm) to manage Node versions.`,
			);
		}
		expect(meetsRequirement).toBe(true);
	});
});
