import { describe, expect, test } from "bun:test";
import { extractStatements, parseExports, parseImports } from "./parseSource.ts";

describe(extractStatements, () => {
	test("extracts simple statement", () => {
		expect(extractStatements(`export const foo = 1;`, "export")).toEqual([
			{ docComment: null, statement: "export const foo = 1;" },
		]);
	});

	test("extracts statement with braces", () => {
		expect(extractStatements(`export const foo = { a: 1 };`, "export")).toEqual([
			{ docComment: null, statement: "export const foo = { a: 1 };" },
		]);
	});

	test("handles semicolons inside braces", () => {
		expect(extractStatements(`export const foo = { a: 1; b: 2 };`, "export")).toEqual([
			{ docComment: null, statement: "export const foo = { a: 1; b: 2 };" },
		]);
	});

	test("handles nested braces", () => {
		expect(extractStatements(`export const foo = { a: { b: { c: 1; } } };`, "export")).toEqual([
			{ docComment: null, statement: "export const foo = { a: { b: { c: 1; } } };" },
		]);
	});

	test("extracts multiple statements", () => {
		expect(
			extractStatements(
				`
			export const foo = 1;
			export function bar() {}
		`,
				"export",
			),
		).toEqual([
			{ docComment: null, statement: "export const foo = 1;" },
			{ docComment: null, statement: "export function bar() {}" },
		]);
	});

	test("only extracts matching keyword", () => {
		expect(
			extractStatements(
				`
			export const foo = 1;
			import { bar } from "./module.ts";
		`,
				"export",
			),
		).toEqual([{ docComment: null, statement: "export const foo = 1;" }]);
	});

	test("handles multiline statements", () => {
		expect(
			extractStatements(
				`export const foo = {
			a: 1,
			b: 2
		};`,
				"export",
			),
		).toEqual([
			{
				docComment: null,
				statement: `export const foo = {
			a: 1,
			b: 2
		};`,
			},
		]);
	});

	test("handles semicolons inside strings", () => {
		expect(extractStatements(`export const foo = "a;b";`, "export")).toEqual([
			{ docComment: null, statement: `export const foo = "a;b";` },
		]);
	});

	test("handles semicolons inside single-quoted strings", () => {
		expect(extractStatements(`export const foo = 'a;b';`, "export")).toEqual([
			{ docComment: null, statement: `export const foo = 'a;b';` },
		]);
	});

	test("handles semicolons inside template literals", () => {
		expect(extractStatements("export const foo = `a;b`;", "export")).toEqual([
			{ docComment: null, statement: "export const foo = `a;b`;" },
		]);
	});

	test("handles brace pairs inside template literals", () => {
		expect(extractStatements("export const foo = `a;{}b ${foo}`;", "export")).toEqual([
			{ docComment: null, statement: "export const foo = `a;{}b ${foo}`;" },
		]);
	});

	test("returns empty array for no matches", () => {
		expect(extractStatements(`const foo = 1;`, "export")).toEqual([]);
	});

	test("extracts import statements with braces", () => {
		expect(extractStatements(`import { foo } from "./module.ts";`, "import")).toEqual([
			{ docComment: null, statement: `import { foo } from "./module.ts";` },
		]);
	});

	test("extracts import statements without braces", () => {
		expect(extractStatements(`import foo from "./module.ts";`, "import")).toEqual([
			{ docComment: null, statement: `import foo from "./module.ts";` },
		]);
	});

	test("extracts doc comments with statements", () => {
		expect(
			extractStatements(
				`/** A doc comment */
			export const foo = 1;`,
				"export",
			),
		).toEqual([{ docComment: "/** A doc comment */", statement: "export const foo = 1;" }]);
	});

	test("extracts multiline doc comments", () => {
		expect(
			extractStatements(
				`/**
			 * Multiline doc
			 */
			export function bar() {}`,
				"export",
			),
		).toEqual([
			{
				docComment: "/**\n\t\t\t * Multiline doc\n\t\t\t */",
				statement: "export function bar() {}",
			},
		]);
	});

	test("does not capture regular comments as doc comments", () => {
		expect(
			extractStatements(
				`// Regular comment
			export const foo = 1;`,
				"export",
			),
		).toEqual([{ docComment: null, statement: "export const foo = 1;" }]);
	});

	test("handles consecutive statements with braces and no whitespace", () => {
		// This test would fail with off-by-one errors in token skipping logic
		expect(extractStatements(`export class Foo{}export class Bar{}`, "export")).toEqual([
			{ docComment: null, statement: "export class Foo{}" },
			{ docComment: null, statement: "export class Bar{}" },
		]);
	});

	test("extracts namespace as single statement", () => {
		expect(
			extractStatements(
				`export namespace JSX {
	export type Element = string;
	export type Children = number;
}`,
				"export",
			),
		).toEqual([
			{
				docComment: null,
				statement: `export namespace JSX {
	export type Element = string;
	export type Children = number;
}`,
			},
		]);
	});

	test("handles namespace with consecutive export after", () => {
		expect(
			extractStatements(`export namespace Foo{type A=1;}export const bar=2;`, "export"),
		).toEqual([
			{ docComment: null, statement: "export namespace Foo{type A=1;}" },
			{ docComment: null, statement: "export const bar=2;" },
		]);
	});
});

describe(parseExports, () => {
	// Direct exports
	test("parses const export", () => {
		expect(parseExports(`export const foo = "bar";`)).toEqual([
			{ type: "direct", source: `export const foo = "bar";`, name: "foo", kind: "const" },
		]);
	});

	test("parses function export", () => {
		expect(parseExports(`export function myFunc() {}`)).toEqual([
			{ type: "direct", source: "export function myFunc() {}", name: "myFunc", kind: "function" },
		]);
	});

	test("parses class export", () => {
		expect(parseExports(`export class MyClass {}`)).toEqual([
			{ type: "direct", source: "export class MyClass {}", name: "MyClass", kind: "class" },
		]);
	});

	test("parses abstract class export", () => {
		expect(parseExports(`export abstract class MyAbstractClass {}`)).toEqual([
			{
				type: "direct",
				source: "export abstract class MyAbstractClass {}",
				name: "MyAbstractClass",
				kind: "class",
			},
		]);
	});

	test("parses interface export as type", () => {
		expect(parseExports(`export interface MyInterface {}`)).toEqual([
			{
				type: "direct",
				source: "export interface MyInterface {}",
				name: "MyInterface",
				kind: "type",
			},
		]);
	});

	test("parses type export", () => {
		expect(parseExports(`export type MyType = string;`)).toEqual([
			{ type: "direct", source: "export type MyType = string;", name: "MyType", kind: "type" },
		]);
	});

	test("parses namespace export as single item", () => {
		const source = `export namespace JSX {
	export type Element = string;
	export type Children = number;
}`;
		expect(parseExports(source)).toEqual([
			{
				type: "direct",
				source,
				name: "JSX",
				kind: "type",
			},
		]);
	});

	test("captures doc comments", () => {
		expect(
			parseExports(`
			/** This is a doc comment */
			export const foo = 1;
		`),
		).toEqual([
			{
				type: "direct",
				source: "export const foo = 1;",
				name: "foo",
				kind: "const",
				docComment: "/** This is a doc comment */",
			},
		]);
	});

	// Re-exports
	test("parses single re-export", () => {
		expect(parseExports(`export { foo } from "./module.ts";`)).toEqual([
			{
				type: "reexport",
				source: `export { foo } from "./module.ts";`,
				exportedName: "foo",
				originalName: "foo",
				sourceModule: "./module.ts",
				isTypeOnly: false,
			},
		]);
	});

	test("parses renamed re-export", () => {
		expect(parseExports(`export { foo as bar } from "./module.ts";`)).toEqual([
			{
				type: "reexport",
				source: `export { foo as bar } from "./module.ts";`,
				exportedName: "bar",
				originalName: "foo",
				sourceModule: "./module.ts",
				isTypeOnly: false,
			},
		]);
	});

	test("parses type-only re-export", () => {
		expect(parseExports(`export type { Foo } from "./module.ts";`)).toEqual([
			{
				type: "reexport",
				source: `export type { Foo } from "./module.ts";`,
				exportedName: "Foo",
				originalName: "Foo",
				sourceModule: "./module.ts",
				isTypeOnly: true,
			},
		]);
	});

	// Namespace re-exports
	test("parses namespace re-export", () => {
		expect(parseExports(`export * from "./module.ts";`)).toEqual([
			{
				type: "reexport",
				source: `export * from "./module.ts";`,
				exportedName: "*",
				originalName: "*",
				sourceModule: "./module.ts",
				isTypeOnly: false,
			},
		]);
	});

	test("parses namespace re-export with alias", () => {
		expect(parseExports(`export * as utils from "./module.ts";`)).toEqual([
			{
				type: "reexport",
				source: `export * as utils from "./module.ts";`,
				exportedName: "utils",
				originalName: "*",
				sourceModule: "./module.ts",
				isTypeOnly: false,
			},
		]);
	});

	// Mixed exports
	test("parses multiple exports of different types", () => {
		expect(
			parseExports(`
			export const foo = 1;
			export { bar } from "./module.ts";
		`),
		).toEqual([
			{ type: "direct", source: "export const foo = 1;", name: "foo", kind: "const" },
			{
				type: "reexport",
				source: `export { bar } from "./module.ts";`,
				exportedName: "bar",
				originalName: "bar",
				sourceModule: "./module.ts",
				isTypeOnly: false,
			},
		]);
	});

	// Multiple exports
	test("parses multiple re-exports from same source", () => {
		expect(parseExports(`export { foo, bar, baz } from "./module.ts";`)).toEqual([
			{
				type: "reexport",
				source: `export { foo, bar, baz } from "./module.ts";`,
				exportedName: "foo",
				originalName: "foo",
				sourceModule: "./module.ts",
				isTypeOnly: false,
			},
			{
				type: "reexport",
				source: `export { foo, bar, baz } from "./module.ts";`,
				exportedName: "bar",
				originalName: "bar",
				sourceModule: "./module.ts",
				isTypeOnly: false,
			},
			{
				type: "reexport",
				source: `export { foo, bar, baz } from "./module.ts";`,
				exportedName: "baz",
				originalName: "baz",
				sourceModule: "./module.ts",
				isTypeOnly: false,
			},
		]);
	});

	test("captures multiline doc comments", () => {
		expect(
			parseExports(`
			/**
			 * This is a multiline
			 * doc comment
			 */
			export function myFunc() {}
		`),
		).toEqual([
			{
				type: "direct",
				source: "export function myFunc() {}",
				name: "myFunc",
				kind: "function",
				docComment: "/**\n\t\t\t * This is a multiline\n\t\t\t * doc comment\n\t\t\t */",
			},
		]);
	});

	test("handles generic class export", () => {
		expect(parseExports(`export class Container<T> {}`)).toEqual([
			{ type: "direct", source: "export class Container<T> {}", name: "Container", kind: "class" },
		]);
	});

	test("handles generic type export", () => {
		expect(parseExports(`export type Result<T> = T | Error;`)).toEqual([
			{
				type: "direct",
				source: "export type Result<T> = T | Error;",
				name: "Result",
				kind: "type",
			},
		]);
	});

	test("returns empty array for content without exports", () => {
		expect(parseExports(`const foo = "bar";`)).toEqual([]);
	});

	// Error handling
	test("throws error for unrecognized export syntax", () => {
		expect(() => parseExports(`export default foo;`)).toThrow("Unrecognized export statement");
	});
});

describe(parseImports, () => {
	test("parses single named import", () => {
		expect(parseImports(`import { foo } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["foo"] },
		]);
	});

	test("parses multiple named imports", () => {
		expect(parseImports(`import { foo, bar, baz } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["foo", "bar", "baz"] },
		]);
	});

	test("parses renamed imports using original name", () => {
		expect(parseImports(`import { foo as bar } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["foo"] },
		]);
	});

	test("parses mixed named and renamed imports", () => {
		expect(parseImports(`import { foo, bar as baz, qux } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["foo", "bar", "qux"] },
		]);
	});

	test("parses type imports", () => {
		expect(parseImports(`import type { Foo } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["Foo"] },
		]);
	});

	test("parses default type imports", () => {
		expect(parseImports(`import type default from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["default"] },
		]);
		expect(parseImports(`import type default, { Foo } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["default", "Foo"] },
		]);
	});

	test("parses inline type imports", () => {
		expect(parseImports(`import { name, type Name2 } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["name", "Name2"] },
		]);
	});

	test("parses inline type imports with alias", () => {
		expect(parseImports(`import { name, type Name2 as Alias } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["name", "Name2"] },
		]);
	});

	test("parses default import", () => {
		expect(parseImports(`import foo from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["default"] },
		]);
	});

	test("parses namespace import", () => {
		expect(parseImports(`import * as utils from "./utils.ts";`)).toEqual([
			{ path: "./utils.ts", names: ["*"] },
		]);
	});

	test("parses combined default and named imports", () => {
		expect(parseImports(`import baz, { foo, bar as quux } from "./module.ts";`)).toEqual([
			{ path: "./module.ts", names: ["default", "foo", "bar"] },
		]);
	});

	test("parses multiple import statements", () => {
		expect(
			parseImports(`
			import { foo } from "./module1.ts";
			import { bar } from "./module2.ts";
			import baz from "./module3.ts";
		`),
		).toEqual([
			{ path: "./module1.ts", names: ["foo"] },
			{ path: "./module2.ts", names: ["bar"] },
			{ path: "./module3.ts", names: ["default"] },
		]);
	});

	test("handles single quotes", () => {
		expect(parseImports(`import { foo } from './module';`)).toEqual([
			{ path: "./module", names: ["foo"] },
		]);
	});

	test("handles imports with extra whitespace", () => {
		expect(parseImports(`import  {  foo  ,  bar  }  from  "./module"  ;`)).toEqual([
			{ path: "./module", names: ["foo", "bar"] },
		]);
	});

	test("handles multiline imports", () => {
		expect(
			parseImports(`import {
			foo,
			bar,
			baz,
		} from "./module.ts";`),
		).toEqual([{ path: "./module.ts", names: ["foo", "bar", "baz"] }]);
	});

	test("handles imports from parent directories", () => {
		expect(parseImports(`import { foo } from "../parent/module.ts";`)).toEqual([
			{ path: "../parent/module.ts", names: ["foo"] },
		]);
	});

	test("handles imports from node modules", () => {
		expect(parseImports(`import { useState } from "react";`)).toEqual([
			{ path: "react", names: ["useState"] },
		]);
	});

	test("handles scoped package imports", () => {
		expect(parseImports(`import { something } from "@scope/package";`)).toEqual([
			{ path: "@scope/package", names: ["something"] },
		]);
	});

	test("returns empty array for content without imports", () => {
		expect(parseImports(`export const foo = "bar";`)).toEqual([]);
	});

	test("ignores export statements", () => {
		expect(
			parseImports(`
			import { foo } from "./module.ts";
			export { bar } from "./other.ts";
		`),
		).toEqual([{ path: "./module.ts", names: ["foo"] }]);
	});

	test("handles mixed import types in same file", () => {
		expect(
			parseImports(`
			import defaultExport from "./default.ts";
			import { named } from "./named.ts";
			import type { TypeOnly } from "./types.ts";
			import * as namespace from "./namespace.ts";
		`),
		).toEqual([
			{ path: "./default.ts", names: ["default"] },
			{ path: "./named.ts", names: ["named"] },
			{ path: "./types.ts", names: ["TypeOnly"] },
			{ path: "./namespace.ts", names: ["*"] },
		]);
	});

	test("parses side-effect imports", () => {
		expect(parseImports(`import "./side-effect";`)).toEqual([{ path: "./side-effect", names: [] }]);
	});

	test("throws error for unrecognized import syntax", () => {
		expect(() => parseImports(`import from "./module.ts";`)).toThrow(
			"Unrecognized import statement",
		);
	});
});
