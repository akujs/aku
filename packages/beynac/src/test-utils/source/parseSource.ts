/**
 * Marker symbol for type re-exports that haven't been resolved yet.
 */
export const UNRESOLVED_TYPE: unique symbol = Symbol.for("beynac:unresolved-type");

export interface ExtractedStatement {
	docComment: string | null;
	statement: string;
}

type TokenType =
	| "single-line-comment"
	| "doc-comment"
	| "multi-line-comment"
	| "string"
	| "whitespace"
	| "identifier"
	| "other";

interface Token {
	type: TokenType;
	value: string;
}

const tokenPattern = new RegExp(
	[
		// Single-line comment
		"(\\/\\/[^\\n]*)",
		// Doc comment (/** ... */)
		"(\\/\\*\\*(?:[^*]|\\*(?!\\/))*\\*\\/)",
		// Multi-line comment (/* ... */)
		"(\\/\\*(?:[^*]|\\*(?!\\/))*\\*\\/)",
		// Double-quoted string
		'("(?:[^"\\\\]|\\\\.)*")',
		// Single-quoted string
		"('(?:[^'\\\\]|\\\\.)*')",
		// Template literal (simplified - doesn't handle nested ${})
		"(`(?:[^`\\\\]|\\\\.)*`)",
		// Whitespace
		"(\\s+)",
		// Identifier (word characters)
		"(\\w+)",
		// Single character fallback
		"(.)",
	].join("|"),
	"g",
);

function tokenize(content: string): Token[] {
	const tokens: Token[] = [];
	let match;

	while ((match = tokenPattern.exec(content)) !== null) {
		const [
			,
			singleLineComment,
			docComment,
			multiLineComment,
			doubleString,
			singleString,
			templateString,
			whitespace,
			identifier,
			other,
		] = match;

		if (singleLineComment) {
			tokens.push({ type: "single-line-comment", value: singleLineComment });
		} else if (docComment) {
			tokens.push({ type: "doc-comment", value: docComment });
		} else if (multiLineComment) {
			tokens.push({ type: "multi-line-comment", value: multiLineComment });
		} else if (doubleString || singleString || templateString) {
			tokens.push({ type: "string", value: doubleString || singleString || templateString });
		} else if (whitespace) {
			tokens.push({ type: "whitespace", value: whitespace });
		} else if (identifier) {
			tokens.push({ type: "identifier", value: identifier });
		} else if (other) {
			tokens.push({ type: "other", value: other });
		}
	}

	return tokens;
}

/**
 * Extract all statements from source code that begin with a given keyword.
 * Uses tokenization to correctly ignore keywords inside strings and comments.
 */
export function extractStatements(content: string, keyword: string): ExtractedStatement[] {
	const statements: ExtractedStatement[] = [];
	const tokens = tokenize(content);

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		// Only match keyword in identifier tokens
		if (token.type !== "identifier" || token.value !== keyword) {
			continue;
		}

		// Skip import.meta and dynamic import() (not import statements)
		if (keyword === "import") {
			const nextNonWhitespace = tokens.slice(i + 1).find((t) => t.type !== "whitespace");
			if (
				nextNonWhitespace?.type === "other" &&
				(nextNonWhitespace.value === "." || nextNonWhitespace.value === "(")
			) {
				continue;
			}
		}

		// Look backwards for preceding doc comment
		let docComment: string | null = null;
		for (let j = i - 1; j >= 0; j--) {
			const prevToken = tokens[j];
			if (prevToken.type === "whitespace") {
				continue;
			} else if (prevToken.type === "doc-comment") {
				docComment = prevToken.value;
				break;
			} else {
				break;
			}
		}

		// Build the statement by scanning forward
		let braceDepth = 0;
		let hadBraces = false;
		let isFunctionOrClass = false;
		let statementTokens: Token[] = [];

		for (; i < tokens.length; i++) {
			const t = tokens[i];
			statementTokens.push(t);

			// Skip strings and comments when tracking braces
			if (
				t.type === "string" ||
				t.type === "single-line-comment" ||
				t.type === "multi-line-comment"
			) {
				continue;
			}

			if (t.type === "identifier") {
				if (
					t.value === "function" ||
					t.value === "class" ||
					t.value === "interface" ||
					t.value === "namespace"
				) {
					isFunctionOrClass = true;
				}
			} else if (t.type === "other") {
				if (t.value === "{") {
					braceDepth++;
					hadBraces = true;
				} else if (t.value === "}") {
					braceDepth--;
					if (braceDepth === 0 && hadBraces && isFunctionOrClass) {
						// Function/class body closed - statement ends here
						break;
					}
				} else if (t.value === ";" && braceDepth === 0) {
					// Found semicolon at depth 0 - statement ends here
					break;
				}
			}
		}

		const statement = statementTokens
			.map((t) => t.value)
			.join("")
			.trim();
		statements.push({ docComment, statement });
	}

	return statements;
}

export type SourceKind = "const" | "function" | "class" | "type" | "reexport" | "local-alias";

export interface DirectExport {
	name: string;
	kind: "const" | "function" | "class" | "type" | "local-alias";
	docComment?: string;
}

export interface ReExport {
	exportedName: string;
	originalName: string;
	sourceModule: string;
	isTypeOnly: boolean;
}

export type ParsedExport =
	| ({ type: "direct"; source: string } & DirectExport)
	| ({ type: "reexport"; source: string } & ReExport);

export interface Import {
	path: string;
	names: string[];
}

/**
 * Parse all export statements from source code.
 * Combines direct exports and re-exports into a single array.
 * Throws error for unrecognized export syntax.
 */
export function parseExports(content: string): ParsedExport[] {
	const results: ParsedExport[] = [];
	const extracted = extractStatements(content, "export");

	// Pattern for direct exports: export [abstract] [async] const/function/class/interface/type/namespace name
	const directPattern =
		/\bexport\s+(?:abstract\s+)?(?:async\s+)?(const|function|class|interface|type|namespace)\s+(\w+)/;

	// Pattern for destructuring exports: export const { a, b, c } = expression
	const destructuringPattern = /^export\s+const\s+\{([^}]+)\}\s*=/;

	// Pattern for re-exports: export [type] { names } from "module"
	const reexportPattern = /^export\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;

	// Pattern for local named exports: export { a, b as c }
	const localExportPattern = /^export\s+\{([^}]+)\}\s*;/;

	// Pattern for namespace re-exports: export [type] * [as name] from "module"
	const namespaceReexportPattern =
		/^export\s+(type\s+)?\*\s*(?:as\s+(\w+)\s+)?from\s+['"]([^'"]+)['"]/;

	for (const { docComment, statement } of extracted) {
		// Try direct export pattern
		const directMatch = statement.match(directPattern);
		if (directMatch) {
			const keyword = directMatch[1];
			const name = directMatch[2];
			const kind =
				keyword === "interface" || keyword === "namespace"
					? "type"
					: (keyword as DirectExport["kind"]);

			results.push({
				type: "direct",
				source: statement,
				name,
				kind,
				...(docComment ? { docComment } : {}),
			});
			continue;
		}

		// Try destructuring export pattern
		const destructuringMatch = statement.match(destructuringPattern);
		if (destructuringMatch) {
			const namesList = destructuringMatch[1];
			const names = namesList
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
				.map((nameSpec) => {
					// Handle renaming: { original: alias }
					const colonMatch = nameSpec.match(/^(\w+)\s*:\s*(\w+)$/);
					return colonMatch ? colonMatch[2] : nameSpec;
				});

			for (const name of names) {
				results.push({
					type: "direct",
					source: statement,
					name,
					kind: "const",
					...(docComment ? { docComment } : {}),
				});
			}
			continue;
		}

		// Try re-export pattern
		const reexportMatch = statement.match(reexportPattern);
		if (reexportMatch) {
			const isTypeOnly = reexportMatch[1] !== undefined;
			const namesList = reexportMatch[2];
			const sourceModule = reexportMatch[3];

			const names = namesList
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);

			for (const nameSpec of names) {
				// Handle optional "type" prefix and "as alias" pattern
				const renameMatch = nameSpec.match(/^(?:type\s+)?(\w+)\s+as\s+(\w+)$/);
				if (renameMatch) {
					results.push({
						type: "reexport",
						source: statement,
						exportedName: renameMatch[2],
						originalName: renameMatch[1],
						sourceModule,
						isTypeOnly,
					});
				} else {
					// Strip optional "type" prefix
					const nameMatch = nameSpec.match(/^(?:type\s+)?(\w+)$/);
					const name = nameMatch ? nameMatch[1] : nameSpec.trim();
					results.push({
						type: "reexport",
						source: statement,
						exportedName: name,
						originalName: name,
						sourceModule,
						isTypeOnly,
					});
				}
			}
			continue;
		}

		// Try namespace re-export pattern
		const namespaceMatch = statement.match(namespaceReexportPattern);
		if (namespaceMatch) {
			const isTypeOnly = namespaceMatch[1] !== undefined;
			const exportedName = namespaceMatch[2] || "*";
			const sourceModule = namespaceMatch[3];

			results.push({
				type: "reexport",
				source: statement,
				exportedName,
				originalName: "*",
				sourceModule,
				isTypeOnly,
			});
			continue;
		}

		// Try local named export pattern
		const localMatch = statement.match(localExportPattern);
		if (localMatch) {
			const namesList = localMatch[1];
			const names = namesList
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);

			for (const nameSpec of names) {
				// Handle "original as exported" pattern
				const renameMatch = nameSpec.match(/^(\w+)\s+as\s+(\w+)$/);
				const name = renameMatch ? renameMatch[2] : nameSpec.trim();
				results.push({
					type: "direct",
					source: statement,
					name,
					kind: "local-alias",
					...(docComment ? { docComment } : {}),
				});
			}
			continue;
		}

		// No pattern matched - throw error
		throw new Error(`Unrecognized export statement: ${statement}`);
	}

	return results;
}

/**
 * Parse import statements from source code.
 * Handles: import { A, B } from "./module.ts"
 * Handles: import type { A } from "./module.ts"
 * Handles: import defaultExport from "./module.ts"
 * Handles: import * as name from "./module.ts"
 * Handles: import "./module" (side-effect)
 * Throws error for unrecognized import syntax.
 */
export function parseImports(content: string): Import[] {
	const imports: Import[] = [];
	const statements = extractStatements(content, "import");

	// Pattern for named imports with optional default: import [default,] { a, b } from "module"
	const namedPattern =
		/^import\s+(?:type\s+)?(?:(\w+)\s*,\s*)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;

	// Pattern for default-only or namespace imports: import [type] name from "module" or import * as name from "module"
	const simplePattern = /^import\s+(?:type\s+)?(\*\s+as\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/;

	// Pattern for side-effect imports: import "module"
	const sideEffectPattern = /^import\s+['"]([^'"]+)['"]/;

	for (const { statement } of statements) {
		// Try named imports pattern
		const namedMatch = statement.match(namedPattern);
		if (namedMatch) {
			const defaultName = namedMatch[1];
			const namesList = namedMatch[2];
			const path = namedMatch[3];

			const names = namesList
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
				.map((nameSpec) => {
					// Handle optional "type" prefix and "as alias" pattern
					const match = nameSpec.match(/^(?:type\s+)?(\w+)(?:\s+as\s+\w+)?$/);
					return match ? match[1] : nameSpec.trim();
				});

			// Add default if present
			if (defaultName) {
				names.unshift("default");
			}

			imports.push({ path, names });
			continue;
		}

		// Try simple pattern (default/namespace)
		const simpleMatch = statement.match(simplePattern);
		if (simpleMatch) {
			const isNamespace = simpleMatch[1] !== undefined;
			const path = simpleMatch[3];

			imports.push({ path, names: [isNamespace ? "*" : "default"] });
			continue;
		}

		// Try side-effect pattern
		const sideEffectMatch = statement.match(sideEffectPattern);
		if (sideEffectMatch) {
			const path = sideEffectMatch[1];
			imports.push({ path, names: [] });
			continue;
		}

		// No pattern matched - throw error
		throw new Error(`Unrecognized import statement: ${statement}`);
	}

	return imports;
}
