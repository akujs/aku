import { mapObjectValues } from "../../utils.ts";
import { ENTRY_POINTS } from "../entryPoints.ts";
import type { SourceProject } from "./SourceProject.ts";

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
	return project.root
		.allFiles()
		.filter((file) => file.path.includes("/contracts/"))
		.sort((a, b) => a.path.localeCompare(b.path));
}

function generateContractsFileContent(project: SourceProject): string {
	const lines: string[] = [];

	const contractFiles = getContractFiles(project);

	for (const file of contractFiles) {
		lines.push(`export { ${file.basenameWithoutExt} } from "./${file.importPath}";`);
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
	const lines: string[] = ['import { createFacade } from "./core/facade.ts";'];

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

type ExportEntry = { source: string; default: string };

export function getPackageExports(): Record<string, string | ExportEntry> {
	const exports: Record<string, string | ExportEntry> = {};

	for (const [entryKey, sourcePath] of Object.entries(ENTRY_POINTS)) {
		const exportKey = entryKey === "index" ? "." : `./${entryKey}`;

		const jsPath = `./dist/${entryKey}.mjs`;

		exports[exportKey] = {
			source: `./${sourcePath}`,
			default: jsPath,
		};
	}

	return exports;
}
