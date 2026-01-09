import { describe, expect, test } from "bun:test";
import type { SqlDialect } from "./dialect.ts";
import { quoteIdentifiers } from "./quoteIdentifiers.ts";

describe(quoteIdentifiers, () => {
	const dialects: SqlDialect[] = ["postgresql", "sqlite", "mysql", "sqlserver"];

	describe("basic transformation", () => {
		test("quotes lowercase identifiers", () => {
			expectTransform("postgresql", "SELECT id FROM users", 'SELECT "id" FROM "users"');
			expectTransform("sqlite", "SELECT id FROM users", 'SELECT "id" FROM "users"');
			expectTransform("mysql", "SELECT id FROM users", "SELECT `id` FROM `users`");
			expectTransform("sqlserver", "SELECT id FROM users", "SELECT [id] FROM [users]");
		});

		test("quotes lowercase column that shadows keyword", () => {
			expectTransform("postgresql", "SELECT select FROM t", 'SELECT "select" FROM "t"');
			expectTransform("sqlite", "SELECT select FROM t", 'SELECT "select" FROM "t"');
			expectTransform("mysql", "SELECT select FROM t", "SELECT `select` FROM `t`");
			expectTransform("sqlserver", "SELECT select FROM t", "SELECT [select] FROM [t]");
		});

		test.each(dialects)("skips ALL_CAPS: %s", (dialect) => {
			expectNoChange(dialect, "SELECT TRUE, FALSE, NULL");
		});

		test.each(dialects)("no change for empty string: %s", (dialect) => {
			expectNoChange(dialect, "");
		});

		test.each(dialects)("no change for whitespace only: %s", (dialect) => {
			expectNoChange(dialect, "   ");
		});
	});

	describe("already quoted identifiers", () => {
		test.each(dialects)("skips double-quoted identifiers: %s", (dialect) => {
			expectNoChange(dialect, 'SELECT "userId" FROM T');
		});

		test.each(dialects)("skips double-quoted with escaped quote: %s", (dialect) => {
			expectNoChange(dialect, 'SELECT "user""Id" FROM T');
		});
	});

	describe("string literals", () => {
		test.each(dialects)("skips content inside single-quoted strings: %s", (dialect) => {
			expectNoChange(dialect, "SELECT 'userId' FROM T");
		});

		test.each(dialects)("skips content inside strings with escaped quotes: %s", (dialect) => {
			expectNoChange(dialect, "SELECT 'it''s' FROM T");
		});

		test("processes identifier after string", () => {
			expectTransform(
				"postgresql",
				"SELECT 'text', userId FROM T",
				`SELECT 'text', "userId" FROM T`,
			);
			expectTransform("sqlite", "SELECT 'text', userId FROM T", `SELECT 'text', "userId" FROM T`);
			expectTransform("mysql", "SELECT 'text', userId FROM T", "SELECT 'text', `userId` FROM T");
			expectTransform(
				"sqlserver",
				"SELECT 'text', userId FROM T",
				"SELECT 'text', [userId] FROM T",
			);
		});
	});

	describe("escape strings E'...'", () => {
		test.each(dialects)("does not break E-string literals: %s", (dialect) => {
			expectNoChange(dialect, "SELECT E'TEXT' FROM T");
		});

		test("handles backslash-quote in E-string", () => {
			// PostgreSQL: E-strings support backslash escapes, so \' is escape
			expectTransform(
				"postgresql",
				"SELECT E'it\\'s userId', visitorId FROM T",
				`SELECT E'it\\'s userId', "visitorId" FROM T`,
			);
			// SQLite: No E-strings, E is identifier, string ends at \' (backslash is literal)
			// The string is 'it\', then s and userId are identifiers, then ' starts unterminated string
			expectTransform(
				"sqlite",
				"SELECT E'it\\'s userId', visitorId FROM T",
				'SELECT E\'it\\\'"s" "userId"\', visitorId FROM T',
			);
			// MySQL: No E-strings, but MySQL DOES have backslash escapes in strings
			expectTransform(
				"mysql",
				"SELECT E'it\\'s userId', visitorId FROM T",
				"SELECT E'it\\'s userId', `visitorId` FROM T",
			);
			// SQL Server: No E-strings, no backslash escapes, same as SQLite
			// String is 'it\', then s and userId are identifiers, then ' starts unterminated string
			expectTransform(
				"sqlserver",
				"SELECT E'it\\'s userId', visitorId FROM T",
				"SELECT E'it\\'[s] [userId]', visitorId FROM T",
			);
		});
	});

	describe("dollar-quoted strings", () => {
		test("skips content inside simple dollar quote", () => {
			// PostgreSQL: Dollar quotes are recognized
			expectTransform(
				"postgresql",
				"SELECT $$userId$$, visitorId FROM T",
				'SELECT $$userId$$, "visitorId" FROM T',
			);
			// SQLite/MySQL/SQL Server: No dollar quotes, $ not ident start but IS ident continuation
			// So $$ is skipped, then userId$$ is one identifier
			expectTransform(
				"sqlite",
				"SELECT $$userId$$, visitorId FROM T",
				'SELECT $$"userId$$", "visitorId" FROM T',
			);
			expectTransform(
				"mysql",
				"SELECT $$userId$$, visitorId FROM T",
				"SELECT $$`userId$$`, `visitorId` FROM T",
			);
			expectTransform(
				"sqlserver",
				"SELECT $$userId$$, visitorId FROM T",
				"SELECT $$[userId$$], [visitorId] FROM T",
			);
		});

		test("skips content inside tagged dollar quote", () => {
			// PostgreSQL: Dollar quotes are recognized
			expectTransform(
				"postgresql",
				"SELECT $tag$userId$tag$, visitorId FROM T",
				'SELECT $tag$userId$tag$, "visitorId" FROM T',
			);
			// SQLite/MySQL/SQL Server: No dollar quotes, $ not ident start but IS ident continuation
			// So $ is skipped, then tag$userId$tag$ is one identifier
			expectTransform(
				"sqlite",
				"SELECT $tag$userId$tag$, visitorId FROM T",
				'SELECT $"tag$userId$tag$", "visitorId" FROM T',
			);
			expectTransform(
				"mysql",
				"SELECT $tag$userId$tag$, visitorId FROM T",
				"SELECT $`tag$userId$tag$`, `visitorId` FROM T",
			);
			expectTransform(
				"sqlserver",
				"SELECT $tag$userId$tag$, visitorId FROM T",
				"SELECT $[tag$userId$tag$], [visitorId] FROM T",
			);
		});
	});

	test.each(dialects)("does not confuse $1 parameter with dollar quote: %s", (dialect) => {
		expectNoChange(dialect, "SELECT $1 FROM T");
	});

	test.each(dialects)("does not break hex string literals: %s", (dialect) => {
		expectNoChange(dialect, "SELECT X'DEADBEEF' FROM T");
	});

	test.each(dialects)("does not break bit string literals: %s", (dialect) => {
		expectNoChange(dialect, "SELECT B'10101' FROM T");
	});

	test.each(dialects)("does not break unicode string literals: %s", (dialect) => {
		expectNoChange(dialect, "SELECT U&'TEXT' FROM T");
	});

	test.each(dialects)("skips content inside line comment: %s", (dialect) => {
		expectNoChange(dialect, "SELECT -- userId\nFROM T");
	});

	test.each(dialects)("skips content inside line comment at end: %s", (dialect) => {
		expectNoChange(dialect, "SELECT FROM T -- userId");
	});

	test.each(dialects)("skips content inside block comment: %s", (dialect) => {
		expectNoChange(dialect, "SELECT /* userId */ FROM T");
	});

	test("handles nested block comments", () => {
		// PostgreSQL and SQL Server support nested block comments
		expectNoChange("postgresql", "SELECT /* outer /* inner */ still comment */ FROM T");
		expectNoChange("sqlserver", "SELECT /* outer /* inner */ still comment */ FROM T");
		// SQLite and MySQL don't - comment ends at first */
		expectTransform(
			"sqlite",
			"SELECT /* outer /* inner */ still comment */ FROM T",
			`SELECT /* outer /* inner */ "still" "comment" */ FROM T`,
		);
		expectTransform(
			"mysql",
			"SELECT /* outer /* inner */ still comment */ FROM T",
			"SELECT /* outer /* inner */ `still` `comment` */ FROM T",
		);
	});

	test("handles hash comments", () => {
		// MySQL recognises # as line comment
		expectNoChange("mysql", "SELECT # comment\nFROM T");
		// Other dialects don't - # is treated as operator or error
		expectTransform("postgresql", "SELECT id # not a comment", 'SELECT "id" # "not" "a" "comment"');
		expectTransform("sqlite", "SELECT id # not a comment", 'SELECT "id" # "not" "a" "comment"');
		expectTransform("sqlserver", "SELECT id # not a comment", "SELECT [id] # [not] [a] [comment]");
	});

	test("handles backtick identifiers", () => {
		// SQLite and MySQL recognise backticks as identifier quotes
		expectNoChange("sqlite", "SELECT `userId` FROM T");
		expectNoChange("mysql", "SELECT `userId` FROM T");
		// PostgreSQL and SQL Server don't - backtick is not special
		expectTransform("postgresql", "SELECT `col`, id FROM T", 'SELECT `"col"`, "id" FROM T');
		expectTransform("sqlserver", "SELECT `col`, id FROM T", "SELECT `[col]`, [id] FROM T");
	});

	test("handles bracket identifiers", () => {
		// SQLite and SQL Server recognise brackets as identifier quotes
		expectNoChange("sqlite", "SELECT [userId] FROM T");
		expectNoChange("sqlserver", "SELECT [userId] FROM T");
		// PostgreSQL and MySQL don't - brackets are array syntax or error
		expectTransform("postgresql", "SELECT [col], id FROM T", 'SELECT ["col"], "id" FROM T');
		expectTransform("mysql", "SELECT [col], id FROM T", "SELECT [`col`], `id` FROM T");
	});

	test("handles backslash escapes in strings", () => {
		// MySQL uses backslash escapes in strings
		expectNoChange("mysql", "SELECT 'it\\'s' FROM T");
		expectNoChange("mysql", "SELECT 'line1\\nline2' FROM T");
		// Other dialects don't - backslash is literal, so 'it\' ends the string
		// These would be syntax errors in real databases, but we don't crash
		expectNoThrow("postgresql", "SELECT 'it\\'s'");
		expectNoThrow("sqlite", "SELECT 'it\\'s'");
		expectNoThrow("sqlserver", "SELECT 'it\\'s'");
	});

	describe("edge cases", () => {
		test("quotes identifier starting with underscore", () => {
			expectTransform("postgresql", "SELECT _userId FROM T", 'SELECT "_userId" FROM T');
			expectTransform("sqlite", "SELECT _userId FROM T", 'SELECT "_userId" FROM T');
			expectTransform("mysql", "SELECT _userId FROM T", "SELECT `_userId` FROM T");
			expectTransform("sqlserver", "SELECT _userId FROM T", "SELECT [_userId] FROM T");
		});

		test("quotes identifier with dollar", () => {
			expectTransform("postgresql", "SELECT user$id FROM T", 'SELECT "user$id" FROM T');
			expectTransform("sqlite", "SELECT user$id FROM T", 'SELECT "user$id" FROM T');
			expectTransform("mysql", "SELECT user$id FROM T", "SELECT `user$id` FROM T");
			expectTransform("sqlserver", "SELECT user$id FROM T", "SELECT [user$id] FROM T");
		});

		test("quotes identifier with numbers", () => {
			expectTransform("postgresql", "SELECT user123 FROM T", 'SELECT "user123" FROM T');
			expectTransform("sqlite", "SELECT user123 FROM T", 'SELECT "user123" FROM T');
			expectTransform("mysql", "SELECT user123 FROM T", "SELECT `user123` FROM T");
			expectTransform("sqlserver", "SELECT user123 FROM T", "SELECT [user123] FROM T");
		});

		test("handles identifier adjacent to operator", () => {
			expectTransform("postgresql", "SELECT a+userId FROM T", 'SELECT "a"+"userId" FROM T');
			expectTransform("sqlite", "SELECT a+userId FROM T", 'SELECT "a"+"userId" FROM T');
			expectTransform("mysql", "SELECT a+userId FROM T", "SELECT `a`+`userId` FROM T");
			expectTransform("sqlserver", "SELECT a+userId FROM T", "SELECT [a]+[userId] FROM T");
		});
	});

	describe("malformed input", () => {
		test.each(dialects)("handles unterminated single-quoted string: %s", (dialect) => {
			expectNoThrow(dialect, "SELECT 'unterminated");
		});

		test.each(dialects)("handles unterminated double-quoted identifier: %s", (dialect) => {
			expectNoThrow(dialect, 'SELECT "unterminated');
		});

		test.each(dialects)("handles unterminated block comment: %s", (dialect) => {
			expectNoThrow(dialect, "SELECT /* unterminated");
		});

		test.each(dialects)("handles unterminated dollar quote content: %s", (dialect) => {
			expectNoThrow(dialect, "SELECT $$unterminated");
		});

		test.each(dialects)("handles incomplete dollar tag at end of input: %s", (dialect) => {
			// $tag is not a dollar quote - it's $ operator followed by identifier
			expectNoThrow(dialect, "SELECT $tag");
		});

		test.each(dialects)("handles lone dollar at end of input: %s", (dialect) => {
			expectNoThrow(dialect, "SELECT $");
		});

		test.each(dialects)("handles unterminated E-string: %s", (dialect) => {
			expectNoThrow(dialect, "SELECT E'unterminated");
		});

		test.each(dialects)("handles deeply nested block comments: %s", (dialect) => {
			expectNoThrow(dialect, "SELECT /* /* /* /* /* deep */ */ */ */ */ ID");
		});

		test.each(dialects)("handles many consecutive dollars: %s", (dialect) => {
			expectNoThrow(dialect, "SELECT $$$$$");
		});

		test.each(dialects)("handles string of only special characters: %s", (dialect) => {
			expectNoThrow(dialect, "$$$'\"--/**/");
		});
	});

	describe("robustness", () => {
		test.each(dialects)("many nested comments: %s", (dialect) => {
			expectNoThrow(dialect, "SELECT " + "/* ".repeat(100) + "X" + " */".repeat(100) + " FROM T");
		});
	});

	describe("numeric literals", () => {
		test.each(dialects)("does not quote plain integers: %s", (dialect) => {
			expectNoChange(dialect, "SELECT 123 FROM T");
		});

		test.each(dialects)("does not quote decimal numbers: %s", (dialect) => {
			expectNoChange(dialect, "SELECT 123.456 FROM T");
		});

		test.each(dialects)("does not quote hexadecimal literals: %s", (dialect) => {
			expectNoChange(dialect, "SELECT 0xFF FROM T");
			expectNoChange(dialect, "SELECT 0X1A2B FROM T");
		});

		test.each(dialects)("does not quote scientific notation: %s", (dialect) => {
			expectNoChange(dialect, "SELECT 1e10 FROM T");
			expectNoChange(dialect, "SELECT 1E10 FROM T");
			expectNoChange(dialect, "SELECT 1.5e10 FROM T");
			expectNoChange(dialect, "SELECT 1.5E-10 FROM T");
			expectNoChange(dialect, "SELECT 1e+5 FROM T");
		});

		test.each(dialects)("does not quote binary literals: %s", (dialect) => {
			expectNoChange(dialect, "SELECT 0b1010 FROM T");
			expectNoChange(dialect, "SELECT 0B1100 FROM T");
		});

		test.each(dialects)("does not quote numeric separators: %s", (dialect) => {
			expectNoChange(dialect, "SELECT 1_000_000 FROM T");
		});

		test.each(dialects)("handles invalid numeric-like sequences: %s", (dialect) => {
			// We don't validate, just avoid breaking valid syntax
			expectNoChange(dialect, "SELECT 0xGHI FROM T");
			expectNoChange(dialect, "SELECT 1ex FROM T");
			expectNoChange(dialect, "SELECT 123abc FROM T");
		});
	});
});

function expectTransform(dialect: SqlDialect, input: string, expected: string): void {
	expect(quoteIdentifiers(input, dialect)).toBe(expected);
}

function expectNoChange(dialect: SqlDialect, input: string): void {
	expect(quoteIdentifiers(input, dialect)).toBe(input);
}

function expectNoThrow(dialect: SqlDialect, input: string): void {
	expect(() => quoteIdentifiers(input, dialect)).not.toThrow();
}
