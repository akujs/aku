import { describe, expect, test } from "bun:test";

import { quoteIdentifiers, type SqlDialect } from "./quoteIdentifiers.ts";

// =============================================================================
// Test Helpers
// =============================================================================

function expectTransform(dialect: SqlDialect, input: string, expected: string): void {
	expect(quoteIdentifiers(input, dialect)).toBe(expected);
}

function expectNoChange(dialect: SqlDialect, input: string): void {
	expect(quoteIdentifiers(input, dialect)).toBe(input);
}

function expectNoThrow(dialect: SqlDialect, input: string): void {
	expect(() => quoteIdentifiers(input, dialect)).not.toThrow();
}

// =============================================================================
// Tests
// =============================================================================

describe(quoteIdentifiers, () => {
	// =========================================================================
	// Universal Behaviour (all dialects)
	// =========================================================================

	describe("universal behaviour", () => {
		const dialects: SqlDialect[] = ["postgresql", "sqlite", "mysql", "sqlserver"];

		for (const dialect of dialects) {
			describe(dialect, () => {
				test("quotes lowercase identifiers", () => {
					const q = dialect === "mysql" ? "`" : dialect === "sqlserver" ? "[" : '"';
					const qc = dialect === "sqlserver" ? "]" : q;
					expectTransform(dialect, "SELECT id FROM T", `SELECT ${q}id${qc} FROM T`);
				});

				test("quotes lowercase column that shadows keyword", () => {
					const q = dialect === "mysql" ? "`" : dialect === "sqlserver" ? "[" : '"';
					const qc = dialect === "sqlserver" ? "]" : q;
					expectTransform(dialect, "SELECT select FROM T", `SELECT ${q}select${qc} FROM T`);
				});

				test("skips ALL_CAPS", () => {
					expectNoChange(dialect, "SELECT TRUE, FALSE, NULL");
				});

				test("no change for empty string", () => {
					expectNoChange(dialect, "");
				});

				test("no change for whitespace only", () => {
					expectNoChange(dialect, "   ");
				});

				test("skips double-quoted identifiers", () => {
					const q = dialect === "mysql" ? "`" : dialect === "sqlserver" ? "[" : '"';
					const qc = dialect === "sqlserver" ? "]" : q;
					expectTransform(
						dialect,
						'SELECT "userId" FROM users',
						`SELECT "userId" FROM ${q}users${qc}`,
					);
				});

				test("skips content inside single-quoted strings", () => {
					const q = dialect === "mysql" ? "`" : dialect === "sqlserver" ? "[" : '"';
					const qc = dialect === "sqlserver" ? "]" : q;
					expectTransform(
						dialect,
						"SELECT 'userId', visitorId FROM T",
						`SELECT 'userId', ${q}visitorId${qc} FROM T`,
					);
				});

				test("skips content inside strings with doubled-quote escape", () => {
					const q = dialect === "mysql" ? "`" : dialect === "sqlserver" ? "[" : '"';
					const qc = dialect === "sqlserver" ? "]" : q;
					expectTransform(
						dialect,
						"SELECT 'it''s a userId', visitorId FROM T",
						`SELECT 'it''s a userId', ${q}visitorId${qc} FROM T`,
					);
				});

				test("skips content inside line comments", () => {
					const q = dialect === "mysql" ? "`" : dialect === "sqlserver" ? "[" : '"';
					const qc = dialect === "sqlserver" ? "]" : q;
					expectTransform(
						dialect,
						"SELECT visitorId -- userId\nFROM T",
						`SELECT ${q}visitorId${qc} -- userId\nFROM T`,
					);
				});

				test("skips content inside block comments", () => {
					const q = dialect === "mysql" ? "`" : dialect === "sqlserver" ? "[" : '"';
					const qc = dialect === "sqlserver" ? "]" : q;
					expectTransform(
						dialect,
						"SELECT /* userId */ id FROM T",
						`SELECT /* userId */ ${q}id${qc} FROM T`,
					);
				});

				test("handles unterminated single-quoted string", () => {
					expectNoThrow(dialect, "SELECT 'unterminated");
				});

				test("handles unterminated double-quoted identifier", () => {
					expectNoThrow(dialect, 'SELECT "unterminated');
				});

				test("handles unterminated block comment", () => {
					expectNoThrow(dialect, "SELECT /* unterminated");
				});
			});
		}
	});

	// =========================================================================
	// PostgreSQL-specific
	// =========================================================================

	describe("PostgreSQL-specific", () => {
		test("skips content inside dollar quotes", () => {
			expectTransform(
				"postgresql",
				"SELECT $$userId$$, visitorId FROM T",
				'SELECT $$userId$$, "visitorId" FROM T',
			);
		});

		test("skips content inside tagged dollar quotes", () => {
			expectTransform(
				"postgresql",
				"SELECT $tag$userId$tag$, visitorId FROM T",
				'SELECT $tag$userId$tag$, "visitorId" FROM T',
			);
		});

		test("handles positional parameters", () => {
			expectTransform(
				"postgresql",
				"SELECT userId FROM T WHERE id = $1",
				'SELECT "userId" FROM T WHERE "id" = $1',
			);
		});

		test("skips content inside E-strings", () => {
			expectTransform(
				"postgresql",
				"SELECT E'userId\\nLine', visitorId FROM T",
				"SELECT E'userId\\nLine', \"visitorId\" FROM T",
			);
		});

		test("skips content inside E-strings with backslash-quote", () => {
			expectTransform(
				"postgresql",
				"SELECT E'it\\'s userId', visitorId FROM T",
				"SELECT E'it\\'s userId', \"visitorId\" FROM T",
			);
		});

		test("handles unterminated dollar quote", () => {
			expectNoThrow("postgresql", "SELECT $$unterminated");
		});

		test("handles incomplete dollar tag at end of input", () => {
			// $tag is not a dollar quote - it's $ operator followed by identifier
			expectTransform("postgresql", "SELECT $tag", 'SELECT $"tag"');
		});

		test("does not recognise backtick identifiers", () => {
			// In PostgreSQL, backtick is not special - treated as operator or error
			// The `col` would be parsed as: ` (operator?), col (identifier), ` (operator?)
			expectTransform("postgresql", "SELECT `col`, id FROM T", 'SELECT `"col"`, "id" FROM T');
		});

		test("does not recognise bracket identifiers", () => {
			// In PostgreSQL, brackets are array syntax
			expectTransform("postgresql", "SELECT [col], id FROM T", 'SELECT ["col"], "id" FROM T');
		});

		test("does not recognise hash comments", () => {
			// In PostgreSQL, # is not a comment
			expectTransform(
				"postgresql",
				"SELECT id # not a comment",
				'SELECT "id" # "not" "a" "comment"',
			);
		});
	});

	// =========================================================================
	// SQLite-specific
	// =========================================================================

	describe("SQLite-specific", () => {
		test("skips content inside backtick identifiers", () => {
			expectTransform(
				"sqlite",
				"SELECT `userId`, visitorId FROM T",
				'SELECT `userId`, "visitorId" FROM T',
			);
		});

		test("skips content inside bracket identifiers", () => {
			expectTransform(
				"sqlite",
				"SELECT [userId], visitorId FROM T",
				'SELECT [userId], "visitorId" FROM T',
			);
		});

		test("does not recognise dollar quotes", () => {
			// SQLite doesn't have dollar quotes - $$ would be parsed differently
			expectTransform("sqlite", "SELECT $$, id FROM T", 'SELECT $$, "id" FROM T');
		});

		test("does not recognise E-strings", () => {
			// E is just an identifier in SQLite
			expectTransform("sqlite", "SELECT E'text', id FROM T", "SELECT E'text', \"id\" FROM T");
		});

		test("does not use backslash escapes in strings", () => {
			// In SQLite, backslash is literal, so 'it\'s' ends at the backslash-quote
			// This would actually be a syntax error in real SQLite, but our parser
			// treats it as string 'it\' followed by s'
			expectNoThrow("sqlite", "SELECT 'it\\'s'");
		});
	});

	// =========================================================================
	// MySQL-specific
	// =========================================================================

	describe("MySQL-specific", () => {
		test("skips content inside backtick identifiers", () => {
			expectTransform(
				"mysql",
				"SELECT `userId`, visitorId FROM T",
				"SELECT `userId`, `visitorId` FROM T",
			);
		});

		test("handles backslash escapes in strings", () => {
			expectTransform(
				"mysql",
				"SELECT 'it\\'s', visitorId FROM T",
				"SELECT 'it\\'s', `visitorId` FROM T",
			);
		});

		test("handles backslash-n in strings", () => {
			expectTransform(
				"mysql",
				"SELECT 'line1\\nline2', visitorId FROM T",
				"SELECT 'line1\\nline2', `visitorId` FROM T",
			);
		});

		test("skips content inside hash comments", () => {
			expectTransform(
				"mysql",
				"SELECT visitorId # userId\nFROM T",
				"SELECT `visitorId` # userId\nFROM T",
			);
		});

		test("does not recognise bracket identifiers", () => {
			expectTransform("mysql", "SELECT [col], id FROM T", "SELECT [`col`], `id` FROM T");
		});

		test("does not recognise dollar quotes", () => {
			expectTransform("mysql", "SELECT $$, id FROM T", "SELECT $$, `id` FROM T");
		});

		test("does not recognise E-strings", () => {
			// E is just an identifier in MySQL
			expectTransform("mysql", "SELECT E'text', id FROM T", "SELECT E'text', `id` FROM T");
		});
	});

	// =========================================================================
	// SQL Server-specific
	// =========================================================================

	describe("SQL Server-specific", () => {
		test("skips content inside bracket identifiers", () => {
			expectTransform(
				"sqlserver",
				"SELECT [userId], visitorId FROM T",
				"SELECT [userId], [visitorId] FROM T",
			);
		});

		test("does not recognise backtick identifiers", () => {
			expectTransform("sqlserver", "SELECT `col`, id FROM T", "SELECT `[col]`, [id] FROM T");
		});

		test("does not recognise dollar quotes", () => {
			expectTransform("sqlserver", "SELECT $$, id FROM T", "SELECT $$, [id] FROM T");
		});

		test("does not recognise E-strings", () => {
			// E is just an identifier in SQL Server
			expectTransform("sqlserver", "SELECT E'text', id FROM T", "SELECT E'text', [id] FROM T");
		});

		test("does not use backslash escapes in strings", () => {
			// SQL Server doesn't have backslash escapes
			expectNoThrow("sqlserver", "SELECT 'it\\'s'");
		});

		test("does not recognise hash comments", () => {
			expectTransform(
				"sqlserver",
				"SELECT id # not a comment",
				"SELECT [id] # [not] [a] [comment]",
			);
		});
	});

	// =========================================================================
	// Robustness (malformed input - no infinite loops)
	// =========================================================================

	describe("robustness", () => {
		const dialects: SqlDialect[] = ["postgresql", "sqlite", "mysql", "sqlserver"];

		for (const dialect of dialects) {
			describe(dialect, () => {
				test("handles very long input", () => {
					expectNoThrow(dialect, "SELECT " + "ID, ".repeat(10000) + "NAME FROM T");
				});

				test("handles many nested comments", () => {
					expectNoThrow(
						dialect,
						"SELECT " + "/* ".repeat(100) + "X" + " */".repeat(100) + " FROM T",
					);
				});

				test("handles many consecutive dollars", () => {
					expectNoThrow(dialect, "SELECT $$$$$");
				});

				test("handles string of only special characters", () => {
					expectNoThrow(dialect, "$$$'\"--/**/");
				});
			});
		}
	});
});
