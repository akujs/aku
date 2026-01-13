import { AkuError } from "../../core/core-errors.ts";
import { AkuEvent } from "../../core/core-events.ts";
import { isMockable } from "../../testing/mocks.ts";
import { BaseClass, getPrototypeChain } from "../../utils.ts";
import { isEntryPointFile } from "./discoverEntryPoints.ts";
import type { SourceFile } from "./SourceFile.ts";
import { SourceFolder } from "./SourceFolder.ts";

/**
 * Returns an array of error messages for invariant violations in a source file.
 */
export function getFileErrors(file: SourceFile): string[] {
	const errors: string[] = [];

	// No index.ts files - use *-entry-point.ts instead
	if (
		file.isIndexFile() &&
		// TS requires index.ts for @jsxImportSource to work locally
		!file.isJsxRuntimeIndexFile()
	) {
		errors.push(
			`${file.path} is an index file. Avoid index files, only entry point files may re-export symbols.`,
		);
	}

	// Only entry points can re-export
	if (!file.isEntryPoint() && !file.isJsxRuntimeIndexFile()) {
		for (const exp of file.exports) {
			if (exp.reexport) {
				errors.push(
					`${file.path} re-exports "${exp.name}" but is not an entry point. Only *-entry-point.ts files may re-export.`,
				);
				break;
			}
		}
	}

	// Entry points may only re-export, not define values (unless generated)
	if (file.isEntryPoint() && !file.isGenerated) {
		for (const exp of file.exports) {
			if (!exp.reexport) {
				errors.push(
					`${file.path} is an entry point but defines "${exp.name}". Entry points may only re-export symbols.`,
				);
			}
		}
	}

	// Entry point naming validation
	if (file.isEntryPoint() && file.path.includes("/")) {
		// Nested entry point: filename prefix must match parent folder name
		const parts = file.path.split("/");
		const nameFromFile = file.basename.replace("-entry-point.ts", "");
		const parentDir = parts[parts.length - 2];
		if (nameFromFile !== parentDir) {
			errors.push(
				`${file.path}: entry point filename "${nameFromFile}" must match parent directory "${parentDir}"`,
			);
		}
	}

	if (file.isEntryPoint() && !file.path.includes("/")) {
		// Root entry point: error if matching folder exists
		const nameFromFile = file.basename.replace("-entry-point.ts", "");
		const matchingFolder = file.project.root.children.find(
			(child) => child instanceof SourceFolder && child.basename === nameFromFile,
		);
		if (matchingFolder) {
			errors.push(
				`${file.path}: entry point should be moved to ${nameFromFile}/${nameFromFile}-entry-point.ts`,
			);
		}
	}

	for (const exp of file.exports) {
		if (exp.kind === "class") {
			const chain = getPrototypeChain(exp.runtimeValue);
			const extendsBaseClass = chain.includes(BaseClass);
			const extendsAkuError = chain.includes(AkuError);
			const extendsAkuEvent = chain.includes(AkuEvent);
			const endsWithError = exp.name.endsWith("Error");
			const endsWithEvent = exp.name.endsWith("Event");

			if (endsWithError) {
				if (!extendsAkuError) {
					errors.push(`${exp.name} in ${file.path} ends with "Error" but does not extend AkuError`);
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
				const expectedExportFiles = ["errors-entry-point.ts", entryFilePath];
				if (!setsEqual(exportFiles, expectedExportFiles)) {
					errors.push(
						`${exp.name} in ${file.path} should be exported twice in ${expectedExportFiles.join(" and ")}, but the files exporting it are: ${exportFiles.join(", ")}`,
					);
				}
			} else {
				if (extendsAkuError) {
					errors.push(`${exp.name} in ${file.path} extends AkuError but does not end with "Error"`);
				}
			}

			if (endsWithEvent) {
				if (!extendsAkuEvent) {
					errors.push(`${exp.name} in ${file.path} ends with "Event" but does not extend AkuEvent`);
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
				const expectedExportFiles = ["events-entry-point.ts", entryFilePath];
				if (!setsEqual(exportFiles, expectedExportFiles)) {
					errors.push(
						`${exp.name} in ${file.path} should be exported twice in ${expectedExportFiles.join(" and ")}, but the files exporting it are: ${exportFiles.join(", ") || "(no files)"}`,
					);
				}
			} else {
				if (extendsAkuEvent) {
					errors.push(`${exp.name} in ${file.path} extends AkuEvent but does not end with "Event"`);
				}
			}

			// Check base class requirement
			if (!extendsBaseClass && !extendsAkuError && !extendsAkuEvent) {
				errors.push(`${exp.name} in ${file.path} should extend BaseClass, AkuError, or AkuEvent`);
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

		// Check barrel file parent directory re-exports (only for index.ts barrel files, not entry point files)
		const isBarrelFile = file.basename === "index.ts" && !file.isEntryPoint();
		if (isBarrelFile && exp.reexport && exp.reexport.originalFile.startsWith("../")) {
			errors.push(
				`File ${file.path} re-exports from parent directory "${exp.reexport.originalFile}". Files should only re-export from the current directory or subdirectories.`,
			);
		}

		const checkPublicApiDoc = !exp.isPrimitive && !exp.reexport;
		if (checkPublicApiDoc && exp.project.entryPointMode !== "disable") {
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

		// Check for @param with square brackets (not allowed)
		const docCommentText = match[0];
		const bracketedParamPattern = /@param\s+(\[[\w.]+\]?|[\w.]+\])/g;
		let paramMatch;
		while ((paramMatch = bracketedParamPattern.exec(docCommentText)) !== null) {
			// Extract the name of the thing being documented (function, class, etc.)
			const afterComment = file.source.slice(commentEnd);
			const nameMatch = afterComment.match(
				/^\s*export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface)\s+(\w+)/,
			);
			const name = nameMatch ? nameMatch[1] : "unknown";
			errors.push(
				`${file.path}:${lineRange} @param ${paramMatch[1]} in doc comment for ${name}() has square brackets`,
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

	// Check for imports from entry point files
	for (const imp of file.imports) {
		const importBasename = imp.path.split("/").pop() ?? "";
		if (isEntryPointFile(importBasename)) {
			errors.push(
				`${file.path} imports from entry point "${imp.path}". Import from the original source file instead.`,
			);
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
	if (moduleName === "core") return "index-entry-point.ts";
	return `${moduleName}/${moduleName}-entry-point.ts`;
};

const isRelativePath = (path: string): boolean => {
	return path.startsWith("./") || path.startsWith("../");
};
