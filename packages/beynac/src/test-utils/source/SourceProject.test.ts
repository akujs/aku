import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { SourceFolder } from "./SourceFolder.ts";
import { SourceProject } from "./SourceProject.ts";

const fixturesPath = join(import.meta.dir, "__fixtures__");

describe(SourceProject, () => {
	let project: SourceProject;

	beforeAll(async () => {
		project = await SourceProject.load(fixturesPath);
	});

	test("creates correct folder hierarchy", () => {
		expect(project.root).toBeInstanceOf(SourceFolder);
		expect(project.root.path).toBe(".");
		expect(project.getFolder("module")).toBeInstanceOf(SourceFolder);
		expect(project.getFolder("module/submodule")).toBeInstanceOf(SourceFolder);
	});

	test("detects barrel files", () => {
		// Barrel files have same path as their containing folder
		const moduleIndex = project.getFile("module/index.ts");
		expect(moduleIndex.isBarrel).toBe(true);

		const submoduleIndex = project.getFile("module/submodule/index.ts");
		expect(submoduleIndex.isBarrel).toBe(true);

		const exportsFile = project.getFile("exports.ts");
		expect(exportsFile.isBarrel).toBe(false);
	});

	test("extracts export kinds correctly", () => {
		const exportsFile = project.getFile("exports.ts");

		expect(exportsFile.getExport("publicString").kind).toBe("const");
		expect(exportsFile.getExport("PublicClass").kind).toBe("class");
		expect(exportsFile.getExport("publicFunc").kind).toBe("function");
		expect(exportsFile.getExport("PublicInterface").kind).toBe("type");
	});

	test("parses doc comments", () => {
		const exportsFile = project.getFile("exports.ts");

		expect(exportsFile.getExport("publicString").hasDocComment).toBe(true);
		expect(exportsFile.getExport("noDocNumber").hasDocComment).toBe(false);
		expect(exportsFile.getExport("PublicClass").hasDocComment).toBe(true);
		expect(exportsFile.getExport("NoDocClass").hasDocComment).toBe(false);
	});

	test("sets isPrimitive correctly", () => {
		const exportsFile = project.getFile("exports.ts");

		expect(exportsFile.getExport("publicString").isPrimitive).toBe(true);
		expect(exportsFile.getExport("noDocNumber").isPrimitive).toBe(true);
		expect(exportsFile.getExport("internalArray").isPrimitive).toBe(false);
		expect(exportsFile.getExport("PublicClass").isPrimitive).toBe(false);
	});

	test("populates valueToExports map", () => {
		const exportsFile = project.getFile("exports.ts");
		const stringExport = exportsFile.getExport("publicString");

		// Should be able to look up export by its runtime value
		const exportsForValue = project.getExportsForValue(stringExport.runtimeValue);
		expect(exportsForValue).toBeDefined();
		expect(exportsForValue.length).toBeGreaterThan(0);
		expect(exportsForValue[0].name).toBe("publicString");
	});

	test("importPath includes extension for ESM compatibility", () => {
		// importPath now returns full path with extension
		expect(project.getFile("exports.ts").importPath).toBe("exports.ts");
		expect(project.getFile("module/source.ts").importPath).toBe("module/source.ts");
		expect(project.getFile("module/submodule/file.ts").importPath).toBe("module/submodule/file.ts");
		expect(project.getFile("module/index.ts").importPath).toBe("module/index.ts");
		expect(project.getFile("module/submodule/index.ts").importPath).toBe(
			"module/submodule/index.ts",
		);
	});

	test("throws for invalid entry point", () => {
		expect(() => SourceProject.load(fixturesPath, ["public-api/documented.ts"])).not.toThrowError();
		expect(() => SourceProject.load(fixturesPath, ["public-api/invalid.ts"])).toThrowError();
	});

	test("getAliases returns bidirectional aliases", () => {
		// SourceClass is in both module/source.ts and module/index.ts (re-exported)
		const sourceFile = project.getFile("module/source.ts");
		const sourceClass = sourceFile.getExport("SourceClass");

		const moduleIndex = project.getFile("module/index.ts");
		const indexSourceClass = moduleIndex.getExport("SourceClass");

		// Check bidirectional aliases
		expect(sourceClass.getAliases()).toContain(indexSourceClass);
		expect(indexSourceClass.getAliases()).toContain(sourceClass);

		// Also check sourceValue
		const sourceValue = sourceFile.getExport("sourceValue");
		const indexSourceValue = moduleIndex.getExport("sourceValue");

		expect(sourceValue.getAliases()).toContain(indexSourceValue);
		expect(indexSourceValue.getAliases()).toContain(sourceValue);
	});

	test("getAliases returns bidirectional aliases for types", () => {
		const sourceFile = project.getFile("reexports/source.ts");
		const barrelFile = project.getFile("reexports/barrel.ts");

		// OriginalType is re-exported from barrel.ts
		const originalType = sourceFile.getExport("OriginalType");
		const reexportedType = barrelFile.getExport("OriginalType");

		// Check bidirectional aliases
		expect(originalType.getAliases()).toContain(reexportedType);
		expect(reexportedType.getAliases()).toContain(originalType);

		// Also check renamed type (OriginalType as RenamedType)
		const renamedType = barrelFile.getExport("RenamedType");
		expect(originalType.getAliases()).toContain(renamedType);
		expect(renamedType.getAliases()).toContain(originalType);
	});

	test("type re-exports have same runtimeValue as original", () => {
		const sourceFile = project.getFile("reexports/source.ts");
		const barrelFile = project.getFile("reexports/barrel.ts");

		const originalType = sourceFile.getExport("OriginalType");
		const reexportedType = barrelFile.getExport("OriginalType");
		const renamedType = barrelFile.getExport("RenamedType");

		// All should be symbols
		expect(typeof originalType.runtimeValue).toBe("symbol");
		expect(typeof reexportedType.runtimeValue).toBe("symbol");
		expect(typeof renamedType.runtimeValue).toBe("symbol");

		// All should share the same symbol
		expect(reexportedType.runtimeValue).toBe(originalType.runtimeValue);
		expect(renamedType.runtimeValue).toBe(originalType.runtimeValue);
	});

	test("tracks reexport metadata", () => {
		const moduleIndex = project.getFile("module/index.ts");

		// SourceClass is a non-renamed re-export
		const nonRenamedExport = moduleIndex.getExport("SourceClass");
		expect(nonRenamedExport.kind).toBe("reexport");
		expect(nonRenamedExport.reexport).toEqual({
			originalName: "SourceClass",
			originalFile: "./source.ts",
		});

		// Direct exports have no reexport metadata
		const sourceFile = project.getFile("module/source.ts");
		const directExport = sourceFile.getExport("SourceClass");
		expect(directExport.reexport).toBeUndefined();
	});

	test("tracks reexport metadata for various patterns", () => {
		const barrel = project.getFile("reexports/barrel.ts");

		// Simple value re-export
		const simpleValue = barrel.getExport("originalValue");
		expect(simpleValue.kind).toBe("reexport");
		expect(simpleValue.reexport).toEqual({
			originalName: "originalValue",
			originalFile: "./source.ts",
		});

		// Renamed value re-export
		const renamedValue = barrel.getExport("renamedValue");
		expect(renamedValue.kind).toBe("reexport");
		expect(renamedValue.reexport).toEqual({
			originalName: "originalValue",
			originalFile: "./source.ts",
		});

		// Simple type re-export
		const simpleType = barrel.getExport("OriginalInterface");
		expect(simpleType.kind).toBe("reexport");
		expect(simpleType.reexport).toEqual({
			originalName: "OriginalInterface",
			originalFile: "./source.ts",
		});

		// Renamed type re-export
		const renamedType = barrel.getExport("RenamedInterface");
		expect(renamedType.kind).toBe("reexport");
		expect(renamedType.reexport).toEqual({
			originalName: "OriginalInterface",
			originalFile: "./source.ts",
		});
	});

	test("assigns type symbols for type exports", () => {
		const exportsFile = project.getFile("exports.ts");

		const publicInterface = exportsFile.getExport("PublicInterface");
		expect(publicInterface.kind).toBe("type");
		expect(typeof publicInterface.runtimeValue).toBe("symbol");
		expect(publicInterface.runtimeValue).toBe(Symbol.for("type:exports.ts:PublicInterface"));
	});

	test("can navigate around hierarchy", () => {
		// Export → File → Folder → Parent → Project
		const exp = project.getFile("module/source.ts").getExport("SourceClass");
		expect(exp.file.path).toBe("module/source.ts");
		expect(exp.file.folder.path).toBe("module");
		expect(exp.file.folder.parent?.path).toBe(".");
		expect(exp.file.folder.parent?.parent).toBeUndefined();
		expect(exp.project).toBe(project);

		// File → Folder → Project
		const file = project.getFile("module/submodule/file.ts");
		expect(file.folder.path).toBe("module/submodule");
		expect(file.folder.parent?.path).toBe("module");
		expect(file.project).toBe(project);

		// Barrel file importPath includes full path
		const barrel = project.getFile("module/index.ts");
		expect(barrel.folder.path).toBe("module");
		expect(barrel.importPath).toBe("module/index.ts");
	});

	test("handles export * from wildcard re-exports for public API detection", () => {
		const sourceFile = project.getFile("reexports/source.ts");
		const wildcardBarrel = project.getFile("reexports/wildcard-barrel.ts");

		// Wildcard barrel has a single "*" export
		expect(wildcardBarrel.exports.length).toBe(1);
		expect(wildcardBarrel.exports[0].name).toBe("*");
		expect(wildcardBarrel.exports[0].reexport).toEqual({
			originalName: "*",
			originalFile: "./source.ts",
		});

		// The "*" export should be in the value map for all source exports
		const wildcardExport = wildcardBarrel.exports[0];

		for (const sourceExport of sourceFile.exports) {
			// Get all exports for this value
			const exportsForValue = project.getExportsForValue(sourceExport.runtimeValue);

			// Should include both the original and the wildcard
			expect(exportsForValue).toContain(sourceExport);
			expect(exportsForValue).toContain(wildcardExport);

			// Therefore aliases should work
			expect(sourceExport.getAliases()).toContain(wildcardExport);
		}
	});
});
