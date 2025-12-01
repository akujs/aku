import { basename } from "node:path";
import { mapObjectValues } from "../../utils";
import { ENTRY_POINTS } from "../entryPoints";
import type { SourceProject } from "./SourceProject";

export function getGeneratedFileContent(project: SourceProject): Record<string, string> {
	const rawFiles = {
		"contracts.ts": generateContractsFileContent(project),
		"errors.ts": generateErrorsFileContent(project),
		"events.ts": generateEventsFileContent(project),
		"facades.ts": generateFacadesFileContent(project),
	};
	return mapObjectValues(
		rawFiles,
		(content) =>
			"// GENERATED CODE DO NOT EDIT!\n" +
			"// Run `bun regenerate-exports` to regenerate this file\n" +
			content,
	);
}

function getContractFiles(project: SourceProject) {
	// Find all contract files by filtering all files in the project
	return project.root
		.allFiles()
		.filter((file) => file.path.includes("/contracts/"))
		.sort((a, b) => a.path.localeCompare(b.path));
}

function generateContractsFileContent(project: SourceProject): string {
	const lines: string[] = [];

	const contractFiles = getContractFiles(project);

	for (const file of contractFiles) {
		// Get the contract const export (matches the file basename without extension)
		const expectedContractName = file.basenameWithoutExt;
		const contractExport = file.exports.find(
			(exp) => exp.kind === "const" && exp.name === expectedContractName && !exp.reexport,
		);

		if (contractExport) {
			lines.push(`export { ${contractExport.name} } from "./${file.importPath}";`);
		}
	}

	return lines.join("\n") + "\n";
}

function generateErrorsFileContent(project: SourceProject): string {
	const lines: string[] = [];

	const errorFiles = project.root.allFiles().filter((file) => file.path.endsWith("-errors.ts"));

	for (const file of errorFiles) {
		const errorExports = file.exports
			.filter((exp) => exp.kind === "class" && exp.name.endsWith("Error"))
			.map((exp) => exp.name)
			.sort();

		if (errorExports.length > 0) {
			lines.push(`export { ${errorExports.join(", ")} } from "./${file.importPath}";`);
		}
	}

	return lines.join("\n") + "\n";
}

function generateEventsFileContent(project: SourceProject): string {
	const lines: string[] = [];

	const eventFiles = project.root.allFiles().filter((file) => file.path.endsWith("-events.ts"));

	for (const file of eventFiles) {
		const eventExports = file.exports
			.filter((exp) => exp.kind === "class" && exp.name.endsWith("Event"))
			.map((exp) => exp.name)
			.sort();

		if (eventExports.length > 0) {
			lines.push(`export { ${eventExports.join(", ")} } from "./${file.importPath}";`);
		}
	}

	return lines.join("\n") + "\n";
}

function generateFacadesFileContent(project: SourceProject): string {
	const lines: string[] = ['import { createFacade } from "./core/facade";'];

	const contractFiles = getContractFiles(project);

	// Collect all contract imports and facade declarations
	const imports: string[] = [];
	const facades: string[] = [];

	for (const file of contractFiles) {
		// Get the contract const export (matches the file basename without extension)
		const expectedContractName = file.basenameWithoutExt;
		const contractExport = file.exports.find(
			(exp) => exp.kind === "const" && exp.name === expectedContractName && !exp.reexport,
		);

		if (contractExport) {
			const contractName = contractExport.name;
			const contractAlias = `${contractName}Contract`;

			imports.push(`import { ${contractName} as ${contractAlias} } from "./${file.importPath}";`);
			facades.push(
				``,
				`/**`,
				` * Facade for ${contractName}`,
				` */`,
				`export const ${contractName}: ${contractAlias} = createFacade(${contractAlias});`,
			);
		}
	}

	lines.push(...imports, ...facades);

	return lines.join("\n") + "\n";
}

export function getPackageExports(): Record<string, string | { types: string; default: string }> {
	const exports: Record<string, string | { types: string; default: string }> = {};

	for (const [entryKey, sourcePath] of Object.entries(ENTRY_POINTS)) {
		const exportKey = entryKey === "index" ? "." : `./${entryKey}`;

		const jsPath = `./dist/${entryKey}.mjs`;

		const sourceBasename = basename(sourcePath, ".ts");
		const dtsPath = `./dist/${sourceBasename}.d.mts`;

		const jsPathWithoutExt = `./dist/${entryKey}`;
		const dtsPathWithoutExt = `./dist/${sourceBasename}`;

		// The issue we are fixing here, and the reason we generate our package
		// exports rather than relying on tsdown to do this, is that for nested
		// entry points, tsdown generates a dist/subfolder/foo.mjs file and a
		// dist/foo.d.ts file - note the lack of a subfolder in the .d.ts. We
		// therefore need a type mapping in the export entry to correctly locate
		// the types. If a future version of tsdown correctly generates exports
		// by setting the `exports: true` option, we can remove this code.
		if (jsPathWithoutExt === dtsPathWithoutExt) {
			exports[exportKey] = jsPath;
		} else {
			exports[exportKey] = {
				types: dtsPath,
				default: jsPath,
			};
		}
	}

	exports["./package.json"] = "./package.json";

	return exports;
}
