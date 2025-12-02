import { BaseClass } from "../../utils.ts";
import { parseExports, type SourceKind, UNRESOLVED_TYPE } from "./parseSource.ts";
import type { SourceFile } from "./SourceFile.ts";
import type { SourceProject } from "./SourceProject.ts";

/**
 * Represents an exported symbol from a source file.
 */
export class SourceExport extends BaseClass {
	name: string;
	kind: SourceKind;
	hasDocComment: boolean;
	isPrimitive: boolean;
	runtimeValue: unknown;
	source: string;
	project!: SourceProject;
	file!: SourceFile;
	reexport?:
		| {
				originalName: string;
				originalFile: string;
		  }
		| undefined;

	constructor(
		name: string,
		kind: SourceKind,
		value: unknown,
		source: string,
		docComment?: string,
		reexport?: { originalName: string; originalFile: string },
	) {
		super();
		this.name = name;
		this.kind = kind;
		this.runtimeValue = value;
		this.source = source;
		this.hasDocComment = docComment !== undefined;
		this.isPrimitive = SourceExport.#isPrimitiveValue(value);
		if (reexport) {
			this.reexport = reexport;
		}
	}

	protected override getToStringExtra(): string | undefined {
		return this.name;
	}

	/**
	 * Returns all other exports that are aliases of this export (i.e., re-exports of the same value).
	 */
	getAliases(): SourceExport[] {
		const allExports = this.project.getExportsForValue(this.runtimeValue);
		return allExports.filter((exp) => exp !== this);
	}

	/**
	 * Returns true if this export or any sibling export with the same name has a doc comment.
	 * This handles cases like function overloads or interface + TypeToken patterns where
	 * multiple exports share a name but only one needs documentation.
	 */
	isDocumented(): boolean {
		if (this.hasDocComment) {
			return true;
		}
		return this.file.exports.some(
			(exp) => exp.name === this.name && exp !== this && exp.hasDocComment,
		);
	}

	/**
	 * Returns true if this export is part of the public API.
	 * An export is public if it or any of its aliases is in an entry point file.
	 * Primitives are excluded as they don't benefit from doc comments.
	 *
	 * Special case: Type exports that share a name with a public value export
	 * are also considered public (e.g., interface + TypeToken pattern).
	 */
	isPublicApi(): boolean {
		if (this.isPrimitive) {
			return false;
		}

		const allExports = this.project.getExportsForValue(this.runtimeValue);
		const isPublic = allExports.some((exp) => exp.file.isEntryPoint());

		if (isPublic) {
			return true;
		}

		// Check if this is a type export with a corresponding public value export
		if (this.kind === "type") {
			const valueExportWithSameName = this.file.exports.find(
				(exp) => exp.name === this.name && exp.kind !== "type" && exp !== this,
			);
			if (valueExportWithSameName?.isPublicApi()) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Extracts export information from source code content.
	 */
	static extractFromSource(
		content: string,
		runtimeModule: Record<string, unknown>,
		filePath: string,
	): SourceExport[] {
		const exports: SourceExport[] = [];
		const parsed = parseExports(content);

		for (const exp of parsed) {
			if (exp.type === "direct") {
				const runtimeValue =
					exp.kind === "type"
						? Symbol.for(`type:${filePath}:${exp.name}`)
						: runtimeModule[exp.name];

				exports.push(
					new SourceExport(exp.name, exp.kind, runtimeValue, exp.source, exp.docComment),
				);
			} else {
				// Re-export
				const reexportInfo = {
					originalName: exp.originalName,
					originalFile: exp.sourceModule,
				};

				if (exp.isTypeOnly) {
					// Type re-export - use unresolved marker, will be resolved in second pass
					exports.push(
						new SourceExport(
							exp.exportedName,
							"reexport",
							UNRESOLVED_TYPE,
							exp.source,
							undefined,
							reexportInfo,
						),
					);
				} else {
					// Value re-export - runtime value should be available
					const runtimeValue = runtimeModule[exp.exportedName];

					// If runtime value is undefined, it's likely a type with inline type prefix
					if (runtimeValue === undefined) {
						exports.push(
							new SourceExport(
								exp.exportedName,
								"reexport",
								UNRESOLVED_TYPE,
								exp.source,
								undefined,
								reexportInfo,
							),
						);
					} else {
						exports.push(
							new SourceExport(
								exp.exportedName,
								"reexport",
								runtimeValue,
								exp.source,
								undefined,
								reexportInfo,
							),
						);
					}
				}
			}
		}

		return exports;
	}

	static #isPrimitiveValue(value: unknown): boolean {
		if (value === null || value === undefined) {
			return true;
		}

		const type = typeof value;
		// Note: symbols are excluded because type exports use symbols as runtime values
		// and they should still require doc comments
		return type === "string" || type === "number" || type === "boolean" || type === "bigint";
	}
}
