import { describe, expect, test } from "bun:test";

import { quotePostgresIdentifiers } from "./quotePostgresIdentifiers.ts";

function expectTransform(input: string, expected: string): void {
	expect(quotePostgresIdentifiers(input)).toBe(expected);
}

function expectNoChange(input: string): void {
	expect(quotePostgresIdentifiers(input)).toBe(input);
}

function expectNoThrow(input: string): void {
	expect(() => quotePostgresIdentifiers(input)).not.toThrow();
}

describe(quotePostgresIdentifiers, () => {
	describe("basic transformation", () => {
		test("quotes lowercase identifiers", () => {
			expectTransform("SELECT id FROM users", 'SELECT "id" FROM "users"');
		});

		test("quotes lowercase column that shadows keyword", () => {
			expectTransform("SELECT select FROM t", 'SELECT "select" FROM "t"');
		});

		test("skips ALL_CAPS", () => {
			expectNoChange("SELECT TRUE, FALSE, NULL");
		});

		test("no change for empty string", () => {
			expectNoChange("");
		});

		test("no change for whitespace only", () => {
			expectNoChange("   ");
		});
	});

	describe("already quoted identifiers", () => {
		test("skips double-quoted identifiers", () => {
			expectTransform('SELECT "userId" FROM users', 'SELECT "userId" FROM "users"');
		});

		test("skips double-quoted with escaped quote", () => {
			expectTransform('SELECT "user""Id" FROM T', 'SELECT "user""Id" FROM T');
		});

		test("processes unquoted while skipping quoted", () => {
			expectTransform('SELECT "userId", createdAt FROM T', 'SELECT "userId", "createdAt" FROM T');
		});
	});

	describe("string literals", () => {
		test("skips content inside single-quoted strings", () => {
			expectTransform("SELECT 'userId', visitorId FROM T", "SELECT 'userId', \"visitorId\" FROM T");
		});

		test("skips content inside strings with escaped quotes", () => {
			expectTransform(
				"SELECT 'it''s a userId', visitorId FROM T",
				"SELECT 'it''s a userId', \"visitorId\" FROM T",
			);
		});

		test("processes identifier after string", () => {
			expectTransform("SELECT 'text', userId FROM T", "SELECT 'text', \"userId\" FROM T");
		});
	});

	describe("escape strings E'...'", () => {
		test("skips content inside E-string", () => {
			expectTransform(
				"SELECT E'userId\\nLine', visitorId FROM T",
				"SELECT E'userId\\nLine', \"visitorId\" FROM T",
			);
		});

		test("skips content inside E-string with backslash-quote", () => {
			expectTransform(
				"SELECT E'it\\'s userId', visitorId FROM T",
				"SELECT E'it\\'s userId', \"visitorId\" FROM T",
			);
		});
	});

	describe("dollar-quoted strings", () => {
		test("skips content inside simple dollar quote", () => {
			expectTransform(
				"SELECT $$userId$$, visitorId FROM T",
				'SELECT $$userId$$, "visitorId" FROM T',
			);
		});

		test("skips content inside tagged dollar quote", () => {
			expectTransform(
				"SELECT $tag$userId$tag$, visitorId FROM T",
				'SELECT $tag$userId$tag$, "visitorId" FROM T',
			);
		});
	});

	describe("positional parameters", () => {
		test("does not confuse $1 parameter with dollar quote", () => {
			expectTransform(
				"SELECT userId FROM T WHERE id = $1",
				'SELECT "userId" FROM T WHERE "id" = $1',
			);
		});
	});

	describe("hex and bit strings", () => {
		test("X prefix treated as identifier", () => {
			expectTransform("SELECT X'DEADBEEF', userId FROM T", "SELECT X'DEADBEEF', \"userId\" FROM T");
		});

		test("B prefix treated as identifier", () => {
			expectTransform("SELECT B'10101', userId FROM T", "SELECT B'10101', \"userId\" FROM T");
		});
	});

	describe("unicode strings U&'...'", () => {
		test("U prefix treated as identifier, & as operator", () => {
			expectTransform(
				"SELECT U&'userId', visitorId FROM T",
				"SELECT U&'userId', \"visitorId\" FROM T",
			);
		});
	});

	describe("line comments", () => {
		test("skips content inside line comment", () => {
			expectTransform("SELECT visitorId -- userId\nFROM T", 'SELECT "visitorId" -- userId\nFROM T');
		});

		test("skips content inside line comment at end", () => {
			expectTransform("SELECT visitorId FROM T -- userId", 'SELECT "visitorId" FROM T -- userId');
		});
	});

	describe("block comments", () => {
		test("skips content inside block comment", () => {
			expectTransform("SELECT /* userId */ id FROM T", 'SELECT /* userId */ "id" FROM T');
		});

		test("skips nested block comments", () => {
			expectTransform(
				"SELECT /* outer /* inner */ still comment */ id FROM T",
				'SELECT /* outer /* inner */ still comment */ "id" FROM T',
			);
		});
	});

	describe("edge cases", () => {
		test("quotes identifier starting with underscore", () => {
			expectTransform("SELECT _userId FROM T", 'SELECT "_userId" FROM T');
		});

		test("quotes identifier with dollar", () => {
			expectTransform("SELECT user$id FROM T", 'SELECT "user$id" FROM T');
		});

		test("quotes identifier with numbers", () => {
			expectTransform("SELECT user123 FROM T", 'SELECT "user123" FROM T');
		});

		test("handles identifier adjacent to operator", () => {
			expectTransform("SELECT a+userId FROM T", 'SELECT "a"+"userId" FROM T');
		});
	});

	describe("malformed input (no infinite loops)", () => {
		test("handles unterminated single-quoted string", () => {
			expectNoThrow("SELECT 'unterminated");
		});

		test("handles unterminated double-quoted identifier", () => {
			expectNoThrow('SELECT "unterminated');
		});

		test("handles unterminated block comment", () => {
			expectNoThrow("SELECT /* unterminated");
		});

		test("handles unterminated dollar quote content", () => {
			expectNoThrow("SELECT $$unterminated");
		});

		test("handles incomplete dollar tag at end of input", () => {
			// $tag is not a dollar quote - it's $ operator followed by identifier
			expectTransform("SELECT $tag", 'SELECT $"tag"');
		});

		test("handles lone dollar at end of input", () => {
			expectNoThrow("SELECT $");
		});

		test("handles unterminated E-string", () => {
			expectNoThrow("SELECT E'unterminated");
		});

		test("handles deeply nested block comments", () => {
			expectNoThrow("SELECT /* /* /* /* /* deep */ */ */ */ */ ID");
		});

		test("handles many consecutive dollars", () => {
			expectNoThrow("SELECT $$$$$");
		});

		test("handles string of only special characters", () => {
			expectNoThrow("$$$'\"--/**/");
		});
	});

	describe("robustness", () => {
		test("very long input", () => {
			expectNoThrow("SELECT " + "ID, ".repeat(10000) + "NAME FROM T");
		});

		test("many nested comments", () => {
			expectNoThrow("SELECT " + "/* ".repeat(100) + "X" + " */".repeat(100) + " FROM T");
		});
	});

	describe("real-world examples", () => {
		test("handles complex query with multiple features", () => {
			const input = `
        SELECT u.userId, p.createdAt
        FROM users u
        JOIN posts p ON p.authorId = u.userId
        WHERE u.isActive = TRUE -- check active
      `;
			const expected = `
        SELECT "u"."userId", "p"."createdAt"
        FROM "users" "u"
        JOIN "posts" "p" ON "p"."authorId" = "u"."userId"
        WHERE "u"."isActive" = TRUE -- check active
      `;
			expect(quotePostgresIdentifiers(input)).toBe(expected);
		});

		test("handles INSERT with values", () => {
			expect(quotePostgresIdentifiers("INSERT INTO users (userId, userName) VALUES ($1, $2)")).toBe(
				'INSERT INTO "users" ("userId", "userName") VALUES ($1, $2)',
			);
		});

		test("handles UPDATE statement", () => {
			expect(quotePostgresIdentifiers("UPDATE users SET userName = $1 WHERE userId = $2")).toBe(
				'UPDATE "users" SET "userName" = $1 WHERE "userId" = $2',
			);
		});
	});
});
