import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BaseClass } from "../../utils.ts";
import { SourceFile } from "./SourceFile.ts";
import type { SourceProject } from "./SourceProject.ts";

/**
 * Represents a folder in the source tree.
 */
export class SourceFolder extends BaseClass {
	path: string;
	children: (SourceFolder | SourceFile)[];
	project!: SourceProject;
	parent?: SourceFolder | undefined;

	constructor(path: string, children: (SourceFolder | SourceFile)[], parent?: SourceFolder) {
		super();
		this.path = path;
		this.children = children;
		if (parent) {
			this.parent = parent;
		}
	}

	/**
	 * The folder name without the path.
	 */
	get basename(): string {
		const lastSlash = this.path.lastIndexOf("/");
		return lastSlash === -1 ? this.path : this.path.substring(lastSlash + 1);
	}

	protected override getToStringExtra(): string | undefined {
		return this.path;
	}

	/**
	 * Visits all files in this folder tree, calling the visitor function for each file.
	 */
	visitFiles(visitor: (file: SourceFile) => void): void {
		for (const child of this.children) {
			if (child instanceof SourceFile) {
				visitor(child);
			} else if (child instanceof SourceFolder) {
				child.visitFiles(visitor);
			}
		}
	}

	/**
	 * Returns all files in this folder tree.
	 */
	allFiles(): SourceFile[] {
		const files: SourceFile[] = [];
		this.visitFiles((file) => files.push(file));
		return files;
	}

	/**
	 * Loads a folder and recursively scans its contents.
	 */
	static async load(
		folderPath: string,
		projectRoot: string,
		parent?: SourceFolder,
	): Promise<SourceFolder> {
		const relativePath = relative(projectRoot, folderPath);
		const children: (SourceFolder | SourceFile)[] = [];

		// Create the folder first so we can pass it to children
		const folder = new SourceFolder(relativePath || ".", children, parent);

		const entries = readdirSync(folderPath).sort();

		for (const entry of entries) {
			const fullPath = join(folderPath, entry);
			const stat = statSync(fullPath);

			if (stat.isDirectory()) {
				// Skip test-utils directory
				if (entry === "test-utils") {
					continue;
				}
				children.push(await SourceFolder.load(fullPath, projectRoot, folder));
			} else if (SourceFolder.#isSourceFile(entry)) {
				children.push(await SourceFile.load(fullPath, projectRoot, folder));
			}
		}

		return folder;
	}

	static #isSourceFile(filename: string): boolean {
		return (
			(filename.endsWith(".ts") || filename.endsWith(".tsx")) &&
			!filename.endsWith(".d.ts") &&
			!filename.includes(".test.")
		);
	}
}
