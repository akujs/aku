import { Glob } from "bun";
import { readFileSync } from "fs";

export interface CodeBlock {
	source: string | undefined;
	language: string;
	content: string;
	startIndex: number;
	endIndex: number;
}

/**
 * Regex to match code blocks (we'll check for comments separately)
 */
export const CODE_BLOCK_REGEX = /```(?:ts|js|tsx|jsx|typescript|javascript)\s*\n([\s\S]*?)```/g;

/**
 * Regex to match source comments
 */
export const SOURCE_COMMENT_REGEX = /<!--\s*source:\s*(.+?)\s*-->/;

/**
 * Find all markdown files in the docs directory
 */
export async function findMarkdownFiles(docsPath: string): Promise<string[]> {
	const glob = new Glob("**/*.md");
	const files: string[] = [];
	for await (const file of glob.scan({ cwd: docsPath })) {
		files.push(file);
	}
	return files;
}
/**
 * Parse markdown content to extract all code blocks with their source comments
 */
export function parseMarkdownFile(content: string): CodeBlock[] {
	const blocks: CodeBlock[] = [];
	let match: RegExpExecArray | null;

	// Reset regex state
	CODE_BLOCK_REGEX.lastIndex = 0;

	while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
		const fullMatch = match[0];
		const codeContent = match[1];

		// Extract language from the code fence
		const languageMatch = fullMatch.match(/```(\w+)/);
		const language = languageMatch ? languageMatch[1] : "ts";

		// Check if there's a source comment immediately before this code block
		let source: string | undefined;
		const beforeBlock = content.slice(Math.max(0, match.index - 100), match.index);
		const lines = beforeBlock.split("\n");

		// Check the last non-empty line before the code block
		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i].trim();
			if (line) {
				const commentMatch = SOURCE_COMMENT_REGEX.exec(line);
				if (commentMatch) {
					source = commentMatch[1].trim();
				}
				break;
			}
		}

		// For now, we'll just use the code block's start index
		// The comment handling is done separately
		const startIndex = match.index;

		blocks.push({
			source,
			language,
			content: codeContent,
			startIndex,
			endIndex: match.index + fullMatch.length,
		});
	}

	return blocks;
}

/**
 * Valid tokens that can be used in source comments
 */
const VALID_TOKENS = ["no-imports"];

/**
 * Parse source comment to extract test name and tokens
 */
export function parseSourceComment(source: string): {
	testName: string;
	tokens: string[];
} {
	const parts = source.split(";").map((s) => s.trim());
	const testName = parts[0];
	const tokensString = parts[1] || "";

	// Split by commas and/or spaces
	const tokens = tokensString
		.split(/[,\s]+/)
		.filter(Boolean)
		.map((t) => t.toLowerCase());

	// Validate tokens
	for (const token of tokens) {
		if (!VALID_TOKENS.includes(token)) {
			throw new Error(
				`Invalid token in source comment: "${token}". Valid tokens are: ${VALID_TOKENS.join(", ")}`,
			);
		}
	}

	return { testName, tokens };
}

/**
 * Extract aku imports from test file
 */
function extractAkuImports(testFileContent: string): Map<string, string> {
	const imports = new Map<string, string>();

	// Match import statements from aku
	const importRegex = /import\s*\{([^}]+)\}\s*from\s*["']aku["']/g;
	let match: RegExpExecArray | null;

	while ((match = importRegex.exec(testFileContent)) !== null) {
		const importedItems = match[1]
			.split(",")
			.map((item: string) => item.trim())
			.filter(Boolean);

		for (const item of importedItems) {
			// Handle renamed imports (e.g., "Container as MyContainer")
			const [originalName] = item.split(/\s+as\s+/);
			imports.set(originalName.trim(), "@akujs/aku");
		}
	}

	return imports;
}

/**
 * Find identifiers used in code
 */
function findUsedIdentifiers(code: string, availableImports: Map<string, string>): Set<string> {
	const used = new Set<string>();

	// Simple regex to find potential identifier usage
	// This matches word boundaries to avoid partial matches
	for (const [identifier] of availableImports) {
		const regex = new RegExp(`\\b${escapeRegExp(identifier)}\\b`, "g");
		if (regex.test(code)) {
			used.add(identifier);
		}
	}

	return used;
}

/**
 * Generate import statement for used aku identifiers
 */
function generateAkuImport(usedIdentifiers: Set<string>): string {
	if (usedIdentifiers.size === 0) {
		return "";
	}

	const identifiers = Array.from(usedIdentifiers).sort();
	return `import { ${identifiers.join(", ")} } from "@akujs/aku";\n\n`;
}

/**
 * Extract code from test content string by test name
 */
export function extractTestCodeFromContent(content: string, testName: string): string {
	// Match test() or it() with the exact test name and find BEGIN/END markers
	const testRegex = new RegExp(
		`(?:test|it)\\s*\\(\\s*["'\`]${escapeRegExp(testName)}["'\`]\\s*,\\s*(?:async\\s*)?\\(\\)\\s*=>\\s*\\{[\\s\\S]*?//\\s*BEGIN\\s*\\n([\\s\\S]*?)\\n\\s*//\\s*END[\\s\\S]*?\\}\\)`,
		"g",
	);

	const match = testRegex.exec(content);
	if (!match) {
		// Check if the test exists but doesn't have BEGIN/END markers
		const testExistsRegex = new RegExp(
			`(?:test|it)\\s*\\(\\s*["'\`]${escapeRegExp(testName)}["'\`]`,
		);
		if (testExistsRegex.test(content)) {
			throw new Error(`Test "${testName}" found but missing BEGIN/END markers`);
		}
		throw new Error(`Test "${testName}" not found`);
	}

	// Extract the content between BEGIN and END
	let testBody = match[1];

	// Split into lines
	const lines = testBody.split("\n");

	// Find minimum indentation of non-empty lines
	const nonEmptyLines = lines.filter((line) => line.length > 0);
	if (nonEmptyLines.length > 0) {
		const minIndent = Math.min(
			...nonEmptyLines.map((line) => {
				const match = line.match(/^(\s*)/);
				return match ? match[1].length : 0;
			}),
		);

		// Remove the common indentation from all lines
		if (minIndent > 0) {
			testBody = lines
				.map((line) => (line.length >= minIndent ? line.slice(minIndent) : line))
				.join("\n");
		}
	}

	// Trim any trailing/leading empty lines
	return testBody.trim();
}

/**
 * Extract code from a test file by test name
 */
export function extractTestCode(testFilePath: string, testName: string): string {
	let content: string;
	try {
		content = readFileSync(testFilePath, "utf-8");
	} catch (error) {
		throw new Error(`Failed to read test file ${testFilePath}: ${error}`);
	}
	return extractTestCodeFromContent(content, testName);
}

/**
 * Get the expected code for a block from test content
 */
export function getExpectedCodeForBlockFromContent(testContent: string, source: string): string {
	// Parse the source comment to get test name and tokens
	const { testName, tokens } = parseSourceComment(source);

	// Extract the code from the test
	let newCode = extractTestCodeFromContent(testContent, testName);

	// If no-imports token is not present, add aku imports
	if (!tokens.includes("no-imports")) {
		// Extract aku imports from the test content
		const akuImports = extractAkuImports(testContent);

		// Find which aku identifiers are used in the extracted code
		const usedIdentifiers = findUsedIdentifiers(newCode, akuImports);

		// Generate and prepend import statement if needed
		const importStatement = generateAkuImport(usedIdentifiers);
		if (importStatement) {
			newCode = importStatement + newCode;
		}
	}

	return newCode;
}

/**
 * Get the expected code for a block from its test source
 */
export function getExpectedCodeForBlock(testFilePath: string, source: string): string {
	const testFileContent = readFileSync(testFilePath, "utf-8");
	return getExpectedCodeForBlockFromContent(testFileContent, source);
}

/**
 * Process markdown content using test content string
 */
export function processMarkdownFileContentFromString(content: string, testContent: string): string {
	const blocks = parseMarkdownFile(content);

	// Process blocks in reverse order to maintain correct indices
	const sortedBlocks = [...blocks].sort((a, b) => b.startIndex - a.startIndex);

	let updatedContent = content;

	for (const block of sortedBlocks) {
		if (!block.source || block.source === "manual") {
			// Skip manual blocks
			continue;
		}

		try {
			// Get the expected code using the shared function
			const newCode = getExpectedCodeForBlockFromContent(testContent, block.source);

			// Reconstruct just the code block (comment is already there)
			const newBlock = `\`\`\`${block.language}\n${newCode}\n\`\`\``;

			// Find where the actual code block starts (after the comment)
			const codeBlockStart = content.indexOf("```", block.startIndex);
			const codeBlockEnd = block.endIndex;

			// Replace just the code block, preserving everything before it
			updatedContent =
				updatedContent.slice(0, codeBlockStart) + newBlock + updatedContent.slice(codeBlockEnd);
		} catch (error) {
			throw new Error(`Failed to update code block with source "${block.source}": ${error}`);
		}
	}

	return updatedContent;
}

/**
 * Process markdown content and update code blocks from their test sources
 */
export function processMarkdownFileContent(content: string, testFilePath: string): string {
	const testContent = readFileSync(testFilePath, "utf-8");
	return processMarkdownFileContentFromString(content, testContent);
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
