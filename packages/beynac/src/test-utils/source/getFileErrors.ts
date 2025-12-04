import { BeynacError } from "../../core/core-errors.ts";
import { BeynacEvent } from "../../core/core-events.ts";
import { isMockable } from "../../testing/mocks.ts";
import { BaseClass, getPrototypeChain } from "../../utils.ts";
import type { SourceFile } from "./SourceFile.ts";

/**
 * Returns an array of error messages for invariant violations in a source file.
 */
export function getFileErrors(file: SourceFile): string[] {
	const errors: string[] = [];

	for (const exp of file.exports) {
		if (exp.kind === "class") {
			const chain = getPrototypeChain(exp.runtimeValue);
			const extendsBaseClass = chain.includes(BaseClass);
			const extendsBeynacError = chain.includes(BeynacError);
			const extendsBeynacEvent = chain.includes(BeynacEvent);
			const endsWithError = exp.name.endsWith("Error");
			const endsWithEvent = exp.name.endsWith("Event");

			if (endsWithError) {
				if (!extendsBeynacError) {
					errors.push(
						`${exp.name} in ${file.path} ends with "Error" but does not extend BeynacError`,
					);
				}

				const moduleName = file.folder.basename;
				const expectedPath = `${moduleName}/${moduleName}-errors.ts`;
				if (!file.path.endsWith(expectedPath)) {
					errors.push(
						`${exp.name} in ${file.path} is an Error so should be defined in ${expectedPath}`,
					);
				}

				const exportFiles = exp.getAliases().map((e) => e.file.path);
				const entryFilePath = moduleNameToEntryFile(moduleName);
				const expectedExportFiles = ["errors.ts", `${entryFilePath}.ts`];
				if (!setsEqual(exportFiles, expectedExportFiles)) {
					errors.push(
						`${exp.name} in ${file.path} should be exported twice in ${expectedExportFiles.join(" and ")}, but the files exporting it are: ${exportFiles.join(", ")}`,
					);
				}
			} else {
				if (extendsBeynacError) {
					errors.push(
						`${exp.name} in ${file.path} extends BeynacError but does not end with "Error"`,
					);
				}
			}

			if (endsWithEvent) {
				if (!extendsBeynacEvent) {
					errors.push(
						`${exp.name} in ${file.path} ends with "Event" but does not extend BeynacEvent`,
					);
				}

				const moduleName = file.folder.basename;
				const expectedPath = `${moduleName}/${moduleName}-events.ts`;
				if (!file.path.endsWith(expectedPath)) {
					errors.push(
						`${exp.name} in ${file.path} is an Event so should be defined in ${expectedPath}`,
					);
				}

				const exportFiles = exp.getAliases().map((e) => e.file.path);
				const entryFilePath = moduleNameToEntryFile(moduleName);
				const expectedExportFiles = ["events.ts", `${entryFilePath}.ts`];
				if (!setsEqual(exportFiles, expectedExportFiles)) {
					errors.push(
						`${exp.name} in ${file.path} should be exported twice in ${expectedExportFiles.join(" and ")}, but the files exporting it are: ${exportFiles.join(", ") || "(no files)"}`,
					);
				}
			} else {
				if (extendsBeynacEvent) {
					errors.push(
						`${exp.name} in ${file.path} extends BeynacEvent but does not end with "Event"`,
					);
				}
			}

			// Check base class requirement
			if (!extendsBaseClass && !extendsBeynacError && !extendsBeynacEvent) {
				errors.push(
					`${exp.name} in ${file.path} should extend BaseClass, BeynacError, or BeynacEvent`,
				);
			}
		}

		// Check mockable functions (can be exported as const or function)
		if (typeof exp.runtimeValue === "function") {
			const fn = exp.runtimeValue as Function;
			if (isMockable(fn) && fn.name !== exp.name) {
				errors.push(
					`${exp.name} in ${file.path} is mockable but has name "${fn.name}" instead of "${exp.name}"`,
				);
			}
		}

		// Check barrel file rename violations
		if (exp.reexport && exp.reexport.originalName !== exp.name) {
			errors.push(
				`File ${file.path} renames export "${exp.name}". Use 'export { foo }' not 'export { foo as bar }'`,
			);
		}

		// Check barrel file parent directory re-exports (only for index.ts barrel files, not entry files)
		const isBarrelFile = file.basename === "index.ts" && !file.path.startsWith("entry/");
		if (isBarrelFile && exp.reexport && exp.reexport.originalFile.startsWith("../")) {
			errors.push(
				`File ${file.path} re-exports from parent directory "${exp.reexport.originalFile}". Files should only re-export from the current directory or subdirectories.`,
			);
		}

		const checkPublicApiDoc = !exp.isPrimitive && !exp.reexport;
		if (checkPublicApiDoc && exp.project.entryPoints.size > 0) {
			// Check public API doc comments (skip re-exports - doc should be on original)
			if (exp.isPublicApi() && !exp.isDocumented()) {
				errors.push(
					`${exp.name} in ${file.path} is part of the public API but has no doc comment. NOTE TO AI AGENTS: Did you just add this to the public API without being told to? If so the solution is probably to remove it from a public API. Don't modify the public API unless requested.`,
				);
			}

			// Check non-public API exports with doc comments (only when entry points are defined)
			if (!exp.isPublicApi() && exp.isDocumented()) {
				errors.push(
					`${exp.name} in ${file.path} is not part of the public API but has a doc comment. NOTE TO AI AGENTS: the default solution is to remove the comment, unless we're explaining something really important that's not clear from the name, in which case use // line comments.`,
				);
			}
		}
	}

	// Check doc comments for proper whitespace and export following
	const docCommentPattern =
		/(\S?)(\s*)\/\*\*(?:[^*]|\*(?!\/))*\*\/(\n*)(export|type|interface|[ \t]+)?/g;
	let match;
	while ((match = docCommentPattern.exec(file.source)) !== null) {
		// Skip JSX pragma comments (e.g., @jsxImportSource)
		if (match[0].includes("@jsxImportSource")) {
			continue;
		}

		const charBefore = match[1];
		const whitespaceBefore = match[2];
		const newlinesAfter = match[3];
		const exportOrIndent = match[4];

		// Calculate line numbers for the doc comment
		const commentStart = match.index + charBefore.length + whitespaceBefore.length;
		const commentEnd =
			match.index + match[0].length - (newlinesAfter + (exportOrIndent || "")).length;
		const startLine = file.source.slice(0, commentStart).split("\n").length;
		const endLine = file.source.slice(0, commentEnd).split("\n").length;
		const lineRange = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;

		// Check whitespace before has at least 2 newlines (unless at start of file, after {, or indented)
		const newlinesBefore = (whitespaceBefore.match(/\n/g) || []).length;
		const isIndented = /[ \t]/.test(whitespaceBefore);
		if (newlinesBefore < 2 && charBefore !== "" && charBefore !== "{" && !isIndented) {
			errors.push(
				`${file.path}:${lineRange} has ${newlinesBefore} newline${newlinesBefore === 1 ? "" : "s"} before doc comment (minimum 2 required)`,
			);
		}

		// Check whitespace after has at least 1 newline
		const newlinesAfterCount = (newlinesAfter.match(/\n/g) || []).length;
		if (newlinesAfterCount < 1) {
			errors.push(
				`${file.path}:${lineRange} has ${newlinesAfterCount} newlines after doc comment (minimum 1 required)`,
			);
		}

		// Doc comments must apply to (be directly before) an export statement, type, interface or indented content
		if (!exportOrIndent) {
			errors.push(
				`${file.path}:${lineRange} doc comment not followed by export statement, type, or indented content`,
			);
		}
	}

	// Check for imports from central contracts.ts file
	for (const imp of file.imports) {
		if (imp.path.endsWith("/contracts.ts")) {
			errors.push(
				`${file.path} imports from the central contracts.ts file. Import from module-specific contract files instead.`,
			);
			break;
		}
	}

	// Check that relative imports have .ts or .tsx extensions
	for (const imp of file.imports) {
		if (isRelativePath(imp.path) && !imp.path.endsWith(".ts") && !imp.path.endsWith(".tsx")) {
			errors.push(
				`${file.path} imports "${imp.path}" without .ts or .tsx extension. Relative imports must include the file extension.`,
			);
		}
	}

	// Check that relative re-exports have .ts or .tsx extensions
	for (const exp of file.exports) {
		if (exp.reexport) {
			const originalFile = exp.reexport.originalFile;
			if (
				isRelativePath(originalFile) &&
				!originalFile.endsWith(".ts") &&
				!originalFile.endsWith(".tsx")
			) {
				errors.push(
					`${file.path} re-exports from "${originalFile}" without .ts or .tsx extension. Relative imports must include the file extension.`,
				);
			}
		}
	}

	if (file.path.includes("/contracts/")) {
		const contractName = file.basename.replace(/\.ts$/, "");

		// Check for type/interface export with the same name as the file
		if (!file.getExportOrNull(contractName, "type")) {
			errors.push(
				`${file.path} is a contract file but does not export a type or interface named "${contractName}".`,
			);
		}

		// Check for const type token export with the same name and correct token name
		const constExport = file.getExportOrNull(contractName, "const");
		if (!constExport) {
			errors.push(
				`${file.path} is a contract file but does not export a const type token named "${contractName}".`,
			);
		} else {
			const expectedToString = `[${contractName}]`;
			const actualToString = constExport.runtimeValue?.toString();
			if (actualToString !== expectedToString) {
				errors.push(
					`${file.path} type token export "${contractName}" has incorrect name "${actualToString}"`,
				);
			}
		}
	}

	return errors;
}

const setsEqual = <T>(a: T[], b: T[]): boolean => {
	if (a.length !== b.length) return false;
	const aSet = new Set(a);
	return b.every((bItem) => aSet.has(bItem));
};

/** Maps module name to the path of the entry file (relative to src/). */
const moduleNameToEntryFile = (moduleName: string): string => {
	if (moduleName === "core") return "entry/index";
	// Database module has entry point directly in module folder
	if (moduleName === "database") return "database/database-entry-point";
	return `entry/${moduleName}`;
};

const isRelativePath = (path: string): boolean => {
	return path.startsWith("./") || path.startsWith("../");
};
