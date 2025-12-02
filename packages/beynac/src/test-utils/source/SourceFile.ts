import { readFile } from "node:fs/promises";
import { basename, relative } from "node:path";
import { BaseClass } from "../../utils.ts";
import { type Import, parseImports } from "./parseSource.ts";
import { SourceExport } from "./SourceExport.ts";
import type { SourceFolder } from "./SourceFolder.ts";
import type { SourceProject } from "./SourceProject.ts";

/**
 * Represents a source file with its exports.
 */
export class SourceFile extends BaseClass {
	path: string;
	source: string;
	exports: SourceExport[];
	imports: Import[];
	isBarrel: boolean;
	isTestFile: boolean;
	project!: SourceProject;
	folder: SourceFolder;

	constructor(
		path: string,
		source: string,
		exports: SourceExport[],
		imports: Import[],
		isBarrel: boolean,
		isTestFile: boolean,
		folder: SourceFolder,
	) {
		super();
		this.path = path;
		this.source = source;
		this.exports = exports;
		this.imports = imports;
		this.isBarrel = isBarrel;
		this.isTestFile = isTestFile;
		this.folder = folder;
		// Set file reference on all exports
		for (const exp of exports) {
			exp.file = this;
		}
	}

	/**
	 * The path used for importing this file (includes extension for ESM compatibility).
	 */
	get importPath(): string {
		return this.path;
	}

	get basename(): string {
		return basename(this.path);
	}

	get basenameWithoutExt(): string {
		return basename(this.path).replace(/\.\w+?$/, "");
	}

	protected override getToStringExtra(): string | undefined {
		return this.path;
	}

	/**
	 * Gets an export by name, optionally filtered by kind. Returns null if not found.
	 */
	getExportOrNull(name: string, kind?: SourceExport["kind"]): SourceExport | null {
		return (
			this.exports.find((e) => e.name === name && (kind === undefined || e.kind === kind)) ?? null
		);
	}

	/**
	 * Gets an export by name, optionally filtered by kind. Throws if not found.
	 */
	getExport(name: string, kind?: SourceExport["kind"]): SourceExport {
		const exp = this.getExportOrNull(name, kind);
		if (!exp) {
			const kindStr = kind ? ` of kind '${kind}'` : "";
			throw new Error(`Export '${name}'${kindStr} not found in ${this.path}`);
		}
		return exp;
	}

	/**
	 * Returns true if this file is a public API entry point.
	 */
	isEntryPoint(): boolean {
		return this.project.entryPoints.has(this.path);
	}

	/**
	 * Loads a source file and extracts its exports.
	 */
	static async load(
		filePath: string,
		projectRoot: string,
		folder: SourceFolder,
	): Promise<SourceFile> {
		const path = relative(projectRoot, filePath);
		const content = await readFile(filePath, "utf-8");
		const isBarrel = path.endsWith("/index.ts") || path.endsWith("/index.tsx");
		const isTestFile = content.includes("bun:test") || content.includes("node:test");

		if (isTestFile) {
			return new SourceFile(path, content, [], [], isBarrel, true, folder);
		}

		// Load runtime module and extract exports
		const runtimeModule = await import(filePath);

		const exports = SourceExport.extractFromSource(content, runtimeModule, path);
		const imports = parseImports(content);

		return new SourceFile(path, content, exports, imports, isBarrel, false, folder);
	}
}
