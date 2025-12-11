import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { getFileErrors } from "./getFileErrors.ts";
import { SourceProject } from "./SourceProject.ts";

const fixturesPath = join(import.meta.dir, "__fixtures__");

describe(getFileErrors, () => {
	let project: SourceProject;

	beforeAll(async () => {
		project = await SourceProject.load(fixturesPath, "disable");
	});

	test("detects Error naming violations", () => {
		const file = project.getFile("errors/errors-errors.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "GoodError in errors/errors-errors.ts should be exported twice in errors-entry-point.ts and errors/errors-entry-point.ts, but the files exporting it are: entry/errors-entry-point.ts, errors-entry-point.ts",
		    "FooError in errors/errors-errors.ts ends with "Error" but does not extend BeynacError",
		    "FooError in errors/errors-errors.ts should be exported twice in errors-entry-point.ts and errors/errors-entry-point.ts, but the files exporting it are: entry/errors-entry-point.ts, errors-entry-point.ts",
		    "NotInRootErrorsError in errors/errors-errors.ts should be exported twice in errors-entry-point.ts and errors/errors-entry-point.ts, but the files exporting it are: entry/errors-entry-point.ts",
		    "NotInLocalErrorsError in errors/errors-errors.ts should be exported twice in errors-entry-point.ts and errors/errors-entry-point.ts, but the files exporting it are: errors-entry-point.ts",
		    "BadErrorExtension in errors/errors-errors.ts extends BeynacError but does not end with "Error"",
		  ]
		`);
	});

	test("detects Event naming violations", () => {
		const file = project.getFile("errors/errors-events.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "GoodEvent in errors/errors-events.ts should be exported twice in events-entry-point.ts and errors/errors-entry-point.ts, but the files exporting it are: entry/errors-entry-point.ts",
		    "FooEvent in errors/errors-events.ts ends with "Event" but does not extend BeynacEvent",
		    "FooEvent in errors/errors-events.ts should be exported twice in events-entry-point.ts and errors/errors-entry-point.ts, but the files exporting it are: entry/errors-entry-point.ts",
		    "BadEventExtension in errors/errors-events.ts extends BeynacEvent but does not end with "Event"",
		  ]
		`);
	});

	test("detects missing base class", () => {
		const file = project.getFile("errors/bad-base-class.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "Standalone in errors/bad-base-class.ts should extend BaseClass, BeynacError, or BeynacEvent",
		  ]
		`);
	});

	test("detects mockable function name mismatch", () => {
		const file = project.getFile("errors/bad-mockable-name.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "exportedName in errors/bad-mockable-name.ts is mockable but has name "wrongName" instead of "exportedName"",
		  ]
		`);
	});

	test("detects index.ts files", () => {
		const file = project.getFile("errors/bad-index-file/index.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-index-file/index.ts is an index file. Avoid index files, only entry point files may re-export symbols.",
		    "errors/bad-index-file/index.ts re-exports "Something" but is not an entry point. Only *-entry-point.ts files may re-export.",
		  ]
		`);
	});

	test("detects non-entry-point re-exports", () => {
		const file = project.getFile("errors/bad-reexport.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-reexport.ts re-exports "ParentExport" but is not an entry point. Only *-entry-point.ts files may re-export.",
		  ]
		`);
	});

	test("detects barrel file rename violations", () => {
		const file = project.getFile("errors/bad-barrel-file-reexport/index.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-barrel-file-reexport/index.ts is an index file. Avoid index files, only entry point files may re-export symbols.",
		    "errors/bad-barrel-file-reexport/index.ts re-exports "GoodExport" but is not an entry point. Only *-entry-point.ts files may re-export.",
		    "File errors/bad-barrel-file-reexport/index.ts renames export "RenamedThing". Use 'export { foo }' not 'export { foo as bar }'",
		  ]
		`);
	});

	test("detects barrel file parent directory re-exports", () => {
		const file = project.getFile("errors/bad-barrel-file-import/index.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-barrel-file-import/index.ts is an index file. Avoid index files, only entry point files may re-export symbols.",
		    "errors/bad-barrel-file-import/index.ts re-exports "ParentExport" but is not an entry point. Only *-entry-point.ts files may re-export.",
		    "File errors/bad-barrel-file-import/index.ts re-exports from parent directory "../parent-export.ts". Files should only re-export from the current directory or subdirectories.",
		  ]
		`);
	});

	test("detects badly formatted block comments", () => {
		const file = project.getFile("errors/bad-block-comment.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-block-comment.ts:12 doc comment not followed by export statement, type, or indented content",
		    "errors/bad-block-comment.ts:15-17 doc comment not followed by export statement, type, or indented content",
		  ]
		`);
	});

	test("detects imports from central contracts.ts file", () => {
		const file = project.getFile("errors/bad-contracts-import.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-contracts-import.ts imports from the central contracts.ts file. Import from module-specific contract files instead.",
		  ]
		`);
	});

	test("detects imports from entry point files", () => {
		const file = project.getFile("errors/bad-entry-point-import.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-entry-point-import.ts imports from entry point "./bad-entry-point/bad-entry-point-entry-point.ts". Import from the original source file instead.",
		  ]
		`);
	});

	test("detects imports missing file extensions", () => {
		const file = project.getFile("errors/bad-import-extension.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-import-extension.ts re-exports "helper" but is not an entry point. Only *-entry-point.ts files may re-export.",
		    "errors/bad-import-extension.ts imports "./extension-helper.js" without .ts or .tsx extension. Relative imports must include the file extension.",
		    "errors/bad-import-extension.ts re-exports from "./extension-helper.js" without .ts or .tsx extension. Relative imports must include the file extension.",
		  ]
		`);
	});

	test("returns empty array for files without violations", () => {
		const file = project.getFile("exports.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`[]`);
	});
});

describe("public API doc comments", () => {
	let project: SourceProject;

	beforeAll(async () => {
		project = await SourceProject.load(fixturesPath, "discover");
	});

	test("detects missing doc comments on public API exports", () => {
		const file = project.getFile("public-api/undocumented.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "UndocumentedClass in public-api/undocumented.ts is part of the public API but has no doc comment. NOTE TO AI AGENTS: Did you just add this to the public API without being told to? If so the solution is probably to remove it from a public API. Don't modify the public API unless requested.",
		    "undocumentedFunction in public-api/undocumented.ts is part of the public API but has no doc comment. NOTE TO AI AGENTS: Did you just add this to the public API without being told to? If so the solution is probably to remove it from a public API. Don't modify the public API unless requested.",
		    "UndocumentedType in public-api/undocumented.ts is part of the public API but has no doc comment. NOTE TO AI AGENTS: Did you just add this to the public API without being told to? If so the solution is probably to remove it from a public API. Don't modify the public API unless requested.",
		    "UndocumentedInterface in public-api/undocumented.ts is part of the public API but has no doc comment. NOTE TO AI AGENTS: Did you just add this to the public API without being told to? If so the solution is probably to remove it from a public API. Don't modify the public API unless requested.",
		  ]
		`);
	});

	test("passes for documented public API exports", () => {
		const file = project.getFile("public-api/documented.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`[]`);
	});

	test("passes for internal exports without doc comments", () => {
		const file = project.getFile("public-api/internal.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`[]`);
	});

	test("passes for entry point file with re-exports", () => {
		const file = project.getFile("entry/entry-entry-point.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`[]`);
	});

	test("detects doc comments on non-public API exports", () => {
		const file = project.getFile("public-api/non-public-with-doc.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "NonPublicDocumentedClass in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment. NOTE TO AI AGENTS: the default solution is to remove the comment, unless we're explaining something really important that's not clear from the name, in which case use // line comments.",
		    "nonPublicDocumentedFunction in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment. NOTE TO AI AGENTS: the default solution is to remove the comment, unless we're explaining something really important that's not clear from the name, in which case use // line comments.",
		    "NonPublicDocumentedType in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment. NOTE TO AI AGENTS: the default solution is to remove the comment, unless we're explaining something really important that's not clear from the name, in which case use // line comments.",
		    "NonPublicDocumentedInterface in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment. NOTE TO AI AGENTS: the default solution is to remove the comment, unless we're explaining something really important that's not clear from the name, in which case use // line comments.",
		  ]
		`);
	});

	test("detects entry point that defines values", () => {
		const file = project.getFile("errors/bad-entry-point/bad-entry-point-entry-point.ts");
		const errors = getFileErrors(file);

		expect(errors).toMatchInlineSnapshot(`
		  [
		    "errors/bad-entry-point/bad-entry-point-entry-point.ts is an entry point but defines "DefinedHere". Entry points may only re-export symbols.",
		    "DefinedHere in errors/bad-entry-point/bad-entry-point-entry-point.ts is part of the public API but has no doc comment. NOTE TO AI AGENTS: Did you just add this to the public API without being told to? If so the solution is probably to remove it from a public API. Don't modify the public API unless requested.",
		  ]
		`);
	});
});
