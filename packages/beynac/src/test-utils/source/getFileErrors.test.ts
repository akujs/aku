import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { getFileErrors } from "./getFileErrors.ts";
import { SourceProject } from "./SourceProject.ts";

const fixturesPath = join(import.meta.dir, "__fixtures__");

describe(getFileErrors, () => {
	let project: SourceProject;

	beforeAll(async () => {
		project = await SourceProject.load(fixturesPath);
	});

	test("detects Error naming violations", () => {
		const file = project.getFile("errors/errors-errors.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			'FooError in errors/errors-errors.ts ends with "Error" but does not extend BeynacError',
			"NotInRootErrorsError in errors/errors-errors.ts should be exported twice in errors.ts and entry/errors.ts, but the files exporting it are: entry/errors.ts",
			"NotInLocalErrorsError in errors/errors-errors.ts should be exported twice in errors.ts and entry/errors.ts, but the files exporting it are: errors.ts",
			'BadErrorExtension in errors/errors-errors.ts extends BeynacError but does not end with "Error"',
		]);
	});

	test("detects Event naming violations", () => {
		const file = project.getFile("errors/errors-events.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"GoodEvent in errors/errors-events.ts should be exported twice in events.ts and entry/errors.ts, but the files exporting it are: entry/errors.ts",
			'FooEvent in errors/errors-events.ts ends with "Event" but does not extend BeynacEvent',
			"FooEvent in errors/errors-events.ts should be exported twice in events.ts and entry/errors.ts, but the files exporting it are: entry/errors.ts",
			'BadEventExtension in errors/errors-events.ts extends BeynacEvent but does not end with "Event"',
		]);
	});

	test("detects missing base class", () => {
		const file = project.getFile("errors/bad-base-class.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"Standalone in errors/bad-base-class.ts should extend BaseClass, BeynacError, or BeynacEvent",
		]);
	});

	test("detects mockable function name mismatch", () => {
		const file = project.getFile("errors/bad-mockable-name.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			'exportedName in errors/bad-mockable-name.ts is mockable but has name "wrongName" instead of "exportedName"',
		]);
	});

	test("detects barrel file rename violations", () => {
		const file = project.getFile("errors/bad-barrel-file-reexport/index.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"File errors/bad-barrel-file-reexport/index.ts renames export \"RenamedThing\". Use 'export { foo }' not 'export { foo as bar }'",
		]);
	});

	test("detects barrel file parent directory re-exports", () => {
		const file = project.getFile("errors/bad-barrel-file-import/index.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			'File errors/bad-barrel-file-import/index.ts re-exports from parent directory "../parent-export.ts". Files should only re-export from the current directory or subdirectories.',
		]);
	});

	test("detects badly formatted block comments", () => {
		const file = project.getFile("errors/bad-block-comment.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"errors/bad-block-comment.ts:12 doc comment not followed by export statement, type, or indented content",
			"errors/bad-block-comment.ts:15-17 doc comment not followed by export statement, type, or indented content",
		]);
	});

	test("detects imports from central contracts.ts file", () => {
		const file = project.getFile("errors/bad-contracts-import.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			"errors/bad-contracts-import.ts imports from the central contracts.ts file. Import from module-specific contract files instead.",
		]);
	});

	test("detects imports missing file extensions", () => {
		const file = project.getFile("errors/bad-import-extension.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			// from import
			'errors/bad-import-extension.ts imports "./extension-helper.js" without .ts or .tsx extension. Relative imports must include the file extension.',
			// from re-export
			'errors/bad-import-extension.ts re-exports from "./extension-helper.js" without .ts or .tsx extension. Relative imports must include the file extension.',
		]);
	});

	test("returns empty array for files without violations", () => {
		const file = project.getFile("exports.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([]);
	});
});

describe("public API doc comments", () => {
	let project: SourceProject;

	beforeAll(async () => {
		project = await SourceProject.load(fixturesPath, ["entry/public-api.ts"]);
	});

	test("detects missing doc comments on public API exports", () => {
		const file = project.getFile("public-api/undocumented.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			expect.stringContaining(
				"UndocumentedClass in public-api/undocumented.ts is part of the public API but has no doc comment.",
			),
			expect.stringContaining(
				"undocumentedFunction in public-api/undocumented.ts is part of the public API but has no doc comment.",
			),
			expect.stringContaining(
				"UndocumentedType in public-api/undocumented.ts is part of the public API but has no doc comment.",
			),
			expect.stringContaining(
				"UndocumentedInterface in public-api/undocumented.ts is part of the public API but has no doc comment.",
			),
		]);
	});

	test("passes for documented public API exports", () => {
		const file = project.getFile("public-api/documented.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([]);
	});

	test("passes for internal exports without doc comments", () => {
		const file = project.getFile("public-api/internal.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([]);
	});

	test("passes for entry point file with re-exports", () => {
		const file = project.getFile("entry/public-api.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([]);
	});

	test("detects doc comments on non-public API exports", () => {
		const file = project.getFile("public-api/non-public-with-doc.ts");
		const errors = getFileErrors(file);

		expect(errors).toEqual([
			expect.stringContaining(
				"NonPublicDocumentedClass in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment",
			),
			expect.stringContaining(
				"nonPublicDocumentedFunction in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment",
			),
			expect.stringContaining(
				"NonPublicDocumentedType in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment",
			),
			expect.stringContaining(
				"NonPublicDocumentedInterface in public-api/non-public-with-doc.ts is not part of the public API but has a doc comment",
			),
		]);
	});
});
