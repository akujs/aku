import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BaseClass } from "../../utils.ts";
import { UNRESOLVED_TYPE } from "./parseSource.ts";
import type { SourceExport } from "./SourceExport.ts";
import { SourceFile } from "./SourceFile.ts";
import { SourceFolder } from "./SourceFolder.ts";

/**
 * Represents a loaded source code project with metadata about its structure and exports.
 */
export class SourceProject extends BaseClass {
	root: SourceFolder;
	entryPointMode: "discover" | "disable";
	#valueToExports: Map<unknown, SourceExport[]> = new Map();
	#filesByPath = new Map<string, SourceFile>();
	#foldersByPath = new Map<string, SourceFolder>();

	constructor(root: SourceFolder, entryPointMode: "discover" | "disable") {
		super();
		this.root = root;
		this.entryPointMode = entryPointMode;
		this.#buildPathMaps();
		this.#resolveTypeReexports();
		this.#buildValueToExportsMap();
		this.#setProjectReferences();
	}

	/**
	 * Gets all exports that share the same runtime value.
	 */
	getExportsForValue(value: unknown): SourceExport[] {
		return this.#valueToExports.get(value) ?? [];
	}

	/**
	 * Gets a file by its relative path. Throws if not found.
	 */
	getFile(path: string): SourceFile {
		const file = this.#filesByPath.get(path);
		if (!file) {
			throw new Error(`File not found: ${path}`);
		}
		return file;
	}

	/**
	 * Gets a folder by its relative path. Throws if not found.
	 */
	getFolder(path: string): SourceFolder {
		const folder = this.#foldersByPath.get(path);
		if (!folder) {
			throw new Error(`Folder not found: ${path}`);
		}
		return folder;
	}

	/**
	 * Loads a source project from a directory path.
	 *
	 * @param mode - "discover" to recognize *-entry-point.ts files as entry points,
	 *               or "disable" to treat no files as entry points
	 */
	static async load(rootPath: string, mode: "discover" | "disable"): Promise<SourceProject> {
		const root = await SourceFolder.load(rootPath, rootPath);
		return new SourceProject(root, mode);
	}

	static #akuProject: SourceProject | null = null;

	/**
	 * Gets the cached aku SourceProject instance.
	 * Always uses "discover" mode.
	 */
	static async getAku(): Promise<SourceProject> {
		if (!this.#akuProject) {
			const __dirname = dirname(fileURLToPath(import.meta.url));
			const srcDir = join(__dirname, "../..");
			this.#akuProject = await SourceProject.load(srcDir, "discover");
		}
		return this.#akuProject;
	}

	/**
	 * Recursively sets project references on all nodes in the tree.
	 * Navigation references (parent, folder, file) are set during construction.
	 */
	#setProjectReferences(): void {
		this.root.project = this;

		const processFolder = (folder: SourceFolder): void => {
			for (const child of folder.children) {
				if (child instanceof SourceFile) {
					child.project = this;
					for (const exp of child.exports) {
						exp.project = this;
					}
				} else if (child instanceof SourceFolder) {
					child.project = this;
					processFolder(child);
				}
			}
		};

		processFolder(this.root);
	}

	/**
	 * Builds cached maps of paths to files and folders for fast lookup.
	 */
	#buildPathMaps(): void {
		this.#foldersByPath.set(this.root.path, this.root);

		const processFolder = (folder: SourceFolder): void => {
			for (const child of folder.children) {
				if (child instanceof SourceFile) {
					this.#filesByPath.set(child.path, child);
				} else if (child instanceof SourceFolder) {
					this.#foldersByPath.set(child.path, child);
					processFolder(child);
				}
			}
		};

		processFolder(this.root);
	}

	#buildValueToExportsMap() {
		const addExportsToMap = (
			file: SourceFile,
			exportToAdd?: SourceExport,
			visited = new Set<string>(),
		) => {
			if (visited.has(file.path)) return;
			visited.add(file.path);

			for (const exp of file.exports) {
				if (exp.name === "*" && exp.reexport) {
					const sourcePath = this.resolveImportPath(file.path, exp.reexport.originalFile);
					const sourceFile = this.#filesByPath.get(sourcePath);
					if (sourceFile) {
						addExportsToMap(sourceFile, exportToAdd ?? exp, visited);
					}
				}

				if (exp.name !== "*" && exp.runtimeValue !== undefined) {
					const existing = this.#valueToExports.get(exp.runtimeValue) || [];
					existing.push(exportToAdd ?? exp);
					this.#valueToExports.set(exp.runtimeValue, existing);
				}
			}
		};

		this.root.visitFiles((file) => addExportsToMap(file));
	}

	/**
	 * Resolves UNRESOLVED_TYPE markers in type re-exports to their original symbols.
	 */
	#resolveTypeReexports() {
		this.root.visitFiles((file) => {
			for (const exp of file.exports) {
				if (exp.runtimeValue === UNRESOLVED_TYPE && exp.reexport) {
					// Resolve the path to the original file
					const originalPath = this.resolveImportPath(file.path, exp.reexport.originalFile);
					const originalFile = this.#filesByPath.get(originalPath);

					if (originalFile) {
						// Find the original export by name
						const originalExport = originalFile.exports.find(
							(e) => e.name === exp.reexport!.originalName,
						);

						if (originalExport) {
							// Copy the runtime value from the original
							exp.runtimeValue = originalExport.runtimeValue;
						}
					}
				}
			}
		});
	}

	/**
	 * Resolves a relative import path to a file path.
	 */
	resolveImportPath(fromPath: string, relativePath: string): string {
		// Get directory of the source file
		const lastSlash = fromPath.lastIndexOf("/");
		const dir = lastSlash === -1 ? "" : fromPath.substring(0, lastSlash);

		// Resolve the relative path
		const parts = dir ? dir.split("/") : [];
		for (const segment of relativePath.split("/")) {
			if (segment === "..") {
				parts.pop();
			} else if (segment !== ".") {
				parts.push(segment);
			}
		}

		const resolved = parts.join("/");

		// Try with .ts extension first, then .tsx
		if (this.#filesByPath.has(resolved + ".ts")) {
			return resolved + ".ts";
		}
		if (this.#filesByPath.has(resolved + ".tsx")) {
			return resolved + ".tsx";
		}
		// Try as index file
		if (this.#filesByPath.has(resolved + "/index.ts")) {
			return resolved + "/index.ts";
		}
		if (this.#filesByPath.has(resolved + "/index.tsx")) {
			return resolved + "/index.tsx";
		}

		return resolved;
	}
}
